import Foundation
import Capacitor
import Vision
import UIKit
import AVFoundation
import Speech
import SwiftUI
import Translation

public let isCapacitorApp = true

// MARK: - VisionOCR Plugin
@objc(VisionOCRPlugin)
public class VisionOCRPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VisionOCRPlugin"
    public let jsName = "VisionOCR"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "analyzeImage", returnType: CAPPluginReturnPromise)
    ]

    override public func load() {
        print("[GoSavor] ✅ VisionOCRPlugin loaded!")
    }

    @objc func analyzeImage(_ call: CAPPluginCall) {
        print("[GoSavor] analyzeImage called")

        guard let base64String = call.getString("base64str") else {
            call.reject("Missing base64str parameter")
            return
        }

        let cleanBase64 = base64String
            .replacingOccurrences(of: "data:image/jpeg;base64,", with: "")
            .replacingOccurrences(of: "data:image/png;base64,", with: "")
            .replacingOccurrences(of: "data:image/heic;base64,", with: "")

        guard let imageData = Data(base64Encoded: cleanBase64),
              let uiImage = UIImage(data: imageData),
              let cgImage = uiImage.cgImage else {
            call.reject("Invalid image data")
            return
        }

        print("[GoSavor] Image size: \(uiImage.size)")

        let request = VNRecognizeTextRequest { request, error in
            if let error = error {
                print("[GoSavor] Vision error: \(error)")
                call.reject("Vision error: \(error.localizedDescription)")
                return
            }

            guard let observations = request.results as? [VNRecognizedTextObservation] else {
                call.resolve(["results": [] as [Any]])
                return
            }

            print("[GoSavor] Found \(observations.count) text regions")

            var results: [[String: Any]] = []
            for observation in observations {
                guard let candidate = observation.topCandidates(1).first else { continue }
                let box = observation.boundingBox
                let item: [String: Any] = [
                    "text": candidate.string,
                    "boundingBox": [
                        "x": box.origin.x,
                        "y": 1.0 - box.origin.y - box.height,
                        "width": box.width,
                        "height": box.height
                    ],
                    "confidence": observation.confidence
                ]
                results.append(item)
            }

            print("[GoSavor] Returning \(results.count) OCR results")
            call.resolve(["results": results])
        }

        request.recognitionLanguages = ["ja", "en"]
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true

        // Map UIImage orientation to CGImagePropertyOrientation for accurate bounding boxes
        let cgOrientation: CGImagePropertyOrientation
        switch uiImage.imageOrientation {
        case .up: cgOrientation = .up
        case .down: cgOrientation = .down
        case .left: cgOrientation = .left
        case .right: cgOrientation = .right
        case .upMirrored: cgOrientation = .upMirrored
        case .downMirrored: cgOrientation = .downMirrored
        case .leftMirrored: cgOrientation = .leftMirrored
        case .rightMirrored: cgOrientation = .rightMirrored
        @unknown default: cgOrientation = .up
        }
        print("[GoSavor] Image orientation: \(uiImage.imageOrientation.rawValue) → CGOrientation: \(cgOrientation.rawValue)")

        DispatchQueue.global(qos: .userInitiated).async {
            let handler = VNImageRequestHandler(cgImage: cgImage, orientation: cgOrientation)
            do {
                try handler.perform([request])
            } catch {
                print("[GoSavor] Processing error: \(error)")
                call.reject("Vision error: \(error.localizedDescription)")
            }
        }
    }
}

// MARK: - NativeSpeech Plugin (TTS + Speech Recognition)
@objc(NativeSpeechPlugin)
public class NativeSpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeSpeechPlugin"
    public let jsName = "NativeSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "speak", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startListening", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopListening", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getVoices", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "translate", returnType: CAPPluginReturnPromise)
    ]

    private let synthesizer = AVSpeechSynthesizer()
    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    override public func load() {
        print("[GoSavor] ✅ NativeSpeechPlugin loaded!")
    }

    // MARK: - TTS (Text to Speech)
    @objc func speak(_ call: CAPPluginCall) {
        guard let text = call.getString("text") else {
            call.reject("Missing text")
            return
        }
        let lang = call.getString("lang") ?? "ja-JP"
        let rate = call.getFloat("rate") ?? 0.45
        let pitch = call.getFloat("pitch") ?? 1.0

        let utterance = AVSpeechUtterance(string: text)
        utterance.rate = rate
        utterance.pitchMultiplier = pitch

        // Find the best voice: premium > enhanced > default
        let langPrefix = String(lang.prefix(2))
        let allVoices = AVSpeechSynthesisVoice.speechVoices()
        let langVoices = allVoices.filter { $0.language.starts(with: langPrefix) }

        // Sort by quality (best available first)
        let sorted = langVoices.sorted { a, b in
            func score(_ v: AVSpeechSynthesisVoice) -> Int {
                if #available(iOS 16.0, *) { if v.quality == .premium { return 3 } }
                if v.quality == .enhanced { return 2 }
                return 1
            }
            return score(a) > score(b)
        }

        if let best = sorted.first {
            utterance.voice = best
            var qualityName = "default"
            if best.quality == .enhanced { qualityName = "enhanced" }
            if #available(iOS 16.0, *) { if best.quality == .premium { qualityName = "premium" } }
            print("[GoSavor] 🔊 Voice: \(best.name) (\(qualityName))")
        } else {
            utterance.voice = AVSpeechSynthesisVoice(language: lang)
            print("[GoSavor] 🔊 Fallback voice for \(lang)")
        }

        synthesizer.stopSpeaking(at: .immediate)

        // Set audio session for speaker output
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)

        synthesizer.speak(utterance)
        print("[GoSavor] Speaking: \(text.prefix(30))... lang=\(lang)")
        call.resolve(["success": true])
    }

    // MARK: - Speech Recognition (Listen)
    @objc func startListening(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "ja-JP"

        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else {
                call.reject("Speech recognition not authorized")
                return
            }

            guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: lang)),
                  recognizer.isAvailable else {
                call.reject("Speech recognizer not available for \(lang)")
                return
            }

            // Stop any existing
            self.recognitionTask?.cancel()
            self.recognitionTask = nil

            let audioSession = AVAudioSession.sharedInstance()
            try? audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try? audioSession.setActive(true, options: .notifyOthersOnDeactivation)

            self.recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
            guard let request = self.recognitionRequest else {
                call.reject("Unable to create recognition request")
                return
            }
            request.shouldReportPartialResults = true

            self.audioEngine = AVAudioEngine()
            guard let audioEngine = self.audioEngine else {
                call.reject("Unable to create audio engine")
                return
            }

            let inputNode = audioEngine.inputNode
            let recordingFormat = inputNode.outputFormat(forBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
                request.append(buffer)
            }

            audioEngine.prepare()
            do {
                try audioEngine.start()
            } catch {
                call.reject("Audio engine start error: \(error.localizedDescription)")
                return
            }

            print("[GoSavor] 🎤 Listening in \(lang)...")

            self.recognitionTask = recognizer.recognitionTask(with: request) { result, error in
                if let result = result {
                    let text = result.bestTranscription.formattedString
                    let isFinal = result.isFinal
                    // Send partial results back to JS
                    self.notifyListeners("speechResult", data: [
                        "text": text,
                        "isFinal": isFinal
                    ])
                    if isFinal {
                        print("[GoSavor] 🎤 Final: \(text)")
                    }
                }
                if error != nil {
                    self.stopAudioEngine()
                }
            }

            call.resolve(["success": true])
        }
    }

    @objc func stopListening(_ call: CAPPluginCall) {
        stopAudioEngine()
        print("[GoSavor] 🎤 Stopped listening")
        call.resolve(["success": true])
    }

    private func stopAudioEngine() {
        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
        audioEngine = nil
    }

    @objc func getVoices(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "ja"
        let voices = AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.starts(with: lang) }
            .map { voice -> [String: Any] in
                return [
                    "name": voice.name,
                    "lang": voice.language,
                    "quality": voice.quality == .enhanced ? "enhanced" : "default"
                ]
            }
        call.resolve(["voices": voices])
    }

    @objc func translate(_ call: CAPPluginCall) {
        guard let text = call.getString("text") else {
            call.reject("Missing text")
            return
        }
        let from = call.getString("from") ?? "ja"
        let to = call.getString("to") ?? "zh-Hant"

        print("[GoSavor] 🌐 translate: \(text.prefix(30))... (\(from)→\(to))")

        if #available(iOS 18.0, *) {
            Task { @MainActor in
                do {
                    let sourceLang = Locale.Language(identifier: from)
                    let targetLang = Locale.Language(identifier: to)

                    // Create a hidden SwiftUI view with .translationTask
                    let translator = TranslationBridge()
                    let result = try await translator.translate(text: text, from: sourceLang, to: targetLang)
                    print("[GoSavor] ✅ Apple Translate: \(text.prefix(20))... → \(result.prefix(20))...")
                    call.resolve(["translated": result, "engine": "apple"])
                } catch {
                    print("[GoSavor] ❌ Apple Translate error: \(error)")
                    call.resolve(["translated": "", "engine": "failed"])
                }
            }
        } else {
            print("[GoSavor] Apple Translate needs iOS 18+")
            call.resolve(["translated": "", "engine": "unavailable"])
        }
    }
}

// MARK: - SwiftUI Bridge for Apple Translation
// TranslationSession can only be created via .translationTask SwiftUI modifier
// So we embed a hidden SwiftUI view in UIKit to access it

@available(iOS 18.0, *)
class TranslationBridge {
    func translate(text: String, from: Locale.Language, to: Locale.Language) async throws -> String {
        return try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.main.async {
                let view = TranslationHostView(
                    sourceText: text,
                    sourceLang: from,
                    targetLang: to
                ) { result in
                    continuation.resume(returning: result)
                } onError: { error in
                    continuation.resume(throwing: error)
                }

                let hostingController = UIHostingController(rootView: view)
                hostingController.view.frame = CGRect(x: 0, y: 0, width: 1, height: 1)
                hostingController.view.isHidden = true

                // Add to key window temporarily
                if let window = UIApplication.shared.connectedScenes
                    .compactMap({ $0 as? UIWindowScene })
                    .flatMap({ $0.windows })
                    .first(where: { $0.isKeyWindow }) {
                    window.addSubview(hostingController.view)

                    // Clean up after 10 seconds max
                    DispatchQueue.main.asyncAfter(deadline: .now() + 10) {
                        hostingController.view.removeFromSuperview()
                    }
                }
            }
        }
    }
}

@available(iOS 18.0, *)
struct TranslationHostView: View {
    let sourceText: String
    let sourceLang: Locale.Language
    let targetLang: Locale.Language
    let onSuccess: (String) -> Void
    let onError: (Error) -> Void

    @State private var config: TranslationSession.Configuration?

    var body: some View {
        Color.clear
            .frame(width: 1, height: 1)
            .translationTask(config) { session in
                do {
                    let response = try await session.translate(sourceText)
                    onSuccess(response.targetText)
                } catch {
                    onError(error)
                }
            }
            .onAppear {
                config = TranslationSession.Configuration(
                    source: sourceLang,
                    target: targetLang
                )
            }
    }
}

// MARK: - LiveTranslate Plugin (Photo capture → Vision OCR → Translate → Overlay)
import VisionKit
import Vision
import PhotosUI

@available(iOS 16.0, *)
@objc(LiveTranslatePlugin)
public class LiveTranslatePlugin: CAPPlugin, CAPBridgedPlugin, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    public let identifier = "LiveTranslatePlugin"
    public let jsName = "LiveTranslate"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getLastResult", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickImage", returnType: CAPPluginReturnPromise)
    ]

    private var scannerVC: DataScannerViewController?
    private var lastResultData: [String: String]? // Stored for JS to fetch
    private var startCall: CAPPluginCall? // Held until user closes, then resolved with data
    private var pickImageCall: CAPPluginCall? // For pickImage
    private var targetLang = "zh-Hant"
    private var capturedImage: UIImage? // For save to diary

    // Result view
    private var resultOverlay: UIView?
    private var translationContainer: UIView?
    private var showingTranslation = true

    override public func load() {
        print("[GoSavor] ✅ LiveTranslatePlugin loaded!")
    }

    @objc func isSupported(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let supported = DataScannerViewController.isSupported && DataScannerViewController.isAvailable
            call.resolve(["supported": supported])
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        self.targetLang = call.getString("targetLang") ?? "zh-Hant"

        // Clean up any previous pending call
        if let prev = self.startCall {
            prev.resolve(["hasData": false])
        }

        call.keepAlive = true // Don't auto-cleanup — we resolve later when user closes
        self.startCall = call
        self.lastResultData = nil

        DispatchQueue.main.async {
            guard DataScannerViewController.isSupported && DataScannerViewController.isAvailable else {
                call.resolve(["hasData": false])
                self.startCall = nil
                return
            }
            self.showCamera()
            print("[GoSavor] 📷 AR start() called, waiting for close to resolve")
        }
    }

    @objc func getLastResult(_ call: CAPPluginCall) {
        guard let data = lastResultData else {
            call.resolve(["hasData": false])
            return
        }
        call.resolve([
            "hasData": true,
            "imageBase64": data["imageBase64"] ?? "",
            "itemsJSON": data["itemsJSON"] ?? "[]",
            "timestamp": data["timestamp"] ?? ""
        ])
    }

    // MARK: - Pick Image (camera or album, native UI)

    @objc func pickImage(_ call: CAPPluginCall) {
        let source = call.getString("source") ?? "album" // "camera" or "album"
        // Clean up any stuck previous call
        if let prev = self.pickImageCall {
            prev.resolve(["cancelled": true])
        }
        call.keepAlive = true
        self.pickImageCall = call

        DispatchQueue.main.async {
            if source == "camera" {
                guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
                    call.resolve(["cancelled": true])
                    self.pickImageCall = nil
                    return
                }
                let picker = UIImagePickerController()
                picker.sourceType = .camera
                picker.delegate = self
                self.getRootVC()?.present(picker, animated: true)
            } else {
                // Album via PHPicker (clean, no permission needed)
                var config = PHPickerConfiguration()
                config.filter = .images
                config.selectionLimit = 1
                let picker = PHPickerViewController(configuration: config)
                picker.delegate = self
                self.getRootVC()?.present(picker, animated: true)
            }
        }
    }

    private func getRootVC() -> UIViewController? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }?.rootViewController
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.dismissAll()
            call.resolve(["success": true])
        }
    }

    // MARK: - Camera viewfinder

    private func showCamera() {
        resultOverlay?.removeFromSuperview()
        resultOverlay = nil

        Task { @MainActor in
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.text()],
            qualityLevel: .accurate,
            recognizesMultipleItems: true,
            isHighFrameRateTrackingEnabled: false,
            isHighlightingEnabled: true // Show detected text areas as guide
        )

        let screenW = UIScreen.main.bounds.width
        let screenH = UIScreen.main.bounds.height

        // Close button (top-left)
        let closeBtn = UIButton(type: .system)
        closeBtn.setImage(UIImage(systemName: "xmark.circle.fill"), for: .normal)
        closeBtn.tintColor = .white
        closeBtn.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        closeBtn.layer.cornerRadius = 22
        closeBtn.frame = CGRect(x: 20, y: 60, width: 44, height: 44)
        closeBtn.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        scanner.view.addSubview(closeBtn)

        // Title (top-center)
        let titleLabel = UILabel()
        titleLabel.text = "📷 AR即時翻譯"
        titleLabel.textColor = .white
        titleLabel.font = .boldSystemFont(ofSize: 16)
        titleLabel.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        titleLabel.layer.cornerRadius = 12
        titleLabel.clipsToBounds = true
        titleLabel.textAlignment = .center
        titleLabel.frame = CGRect(x: (screenW - 140) / 2, y: 60, width: 140, height: 36)
        scanner.view.addSubview(titleLabel)

        // Shutter button (bottom-center, camera style)
        let shutterBtn = UIButton(type: .custom)
        shutterBtn.frame = CGRect(x: (screenW - 72) / 2, y: screenH - 130, width: 72, height: 72)
        shutterBtn.backgroundColor = .clear
        shutterBtn.layer.cornerRadius = 36
        shutterBtn.layer.borderWidth = 5
        shutterBtn.layer.borderColor = UIColor.white.cgColor
        let innerCircle = UIView(frame: CGRect(x: 7, y: 7, width: 58, height: 58))
        innerCircle.backgroundColor = .white
        innerCircle.layer.cornerRadius = 29
        innerCircle.isUserInteractionEnabled = false
        shutterBtn.addSubview(innerCircle)
        shutterBtn.addTarget(self, action: #selector(shutterTapped), for: .touchUpInside)
        scanner.view.addSubview(shutterBtn)

        // Album button (left of shutter)
        let albumBtn = UIButton(type: .system)
        albumBtn.setImage(UIImage(systemName: "photo.on.rectangle"), for: .normal)
        albumBtn.tintColor = .white
        albumBtn.backgroundColor = UIColor.white.withAlphaComponent(0.2)
        albumBtn.layer.cornerRadius = 25
        albumBtn.frame = CGRect(x: (screenW / 2) - 36 - 60, y: screenH - 120, width: 50, height: 50)
        albumBtn.addTarget(self, action: #selector(albumTapped), for: .touchUpInside)
        scanner.view.addSubview(albumBtn)

        // Hint
        let hintLabel = UILabel()
        hintLabel.text = "拍照或選相簿"
        hintLabel.textColor = .white
        hintLabel.font = .systemFont(ofSize: 14)
        hintLabel.backgroundColor = UIColor.black.withAlphaComponent(0.4)
        hintLabel.layer.cornerRadius = 10
        hintLabel.clipsToBounds = true
        hintLabel.textAlignment = .center
        hintLabel.frame = CGRect(x: 40, y: screenH - 170, width: screenW - 80, height: 30)
        scanner.view.addSubview(hintLabel)

        self.scannerVC = scanner

        if let rootVC = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow })?.rootViewController {
            rootVC.present(scanner, animated: true) {
                try? scanner.startScanning()
                print("[GoSavor] 📷 Photo Translate camera opened")
            }
        }
        } // end Task @MainActor
    }

    // MARK: - Album picker

    @objc private func albumTapped() {
        var config = PHPickerConfiguration()
        config.filter = .images
        config.selectionLimit = 1
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = self
        scannerVC?.present(picker, animated: true)
    }

    // MARK: - Capture → OCR → Translate → Overlay

    @objc private func shutterTapped() {
        guard let scanner = scannerVC else { return }

        Task { @MainActor in
            guard let image = try? await scanner.capturePhoto() else {
                print("[GoSavor] 📷 Failed to capture photo")
                return
            }
            scanner.stopScanning()
            await processImage(image)
        }
    }

    /// Shared processing: OCR → Translate → Show result (used by both camera & album)
    @MainActor
    private func processImage(_ image: UIImage) async {
        guard let scanner = scannerVC else { return }
        self.capturedImage = image

        // Processing overlay
        let processingView = UIView(frame: scanner.view.bounds)
        processingView.backgroundColor = UIColor.black.withAlphaComponent(0.7)

        let spinner = UIActivityIndicatorView(style: .large)
        spinner.color = .white
        spinner.center = CGPoint(x: processingView.bounds.midX, y: processingView.bounds.midY - 20)
        spinner.startAnimating()
        processingView.addSubview(spinner)

        let loadingLabel = UILabel()
        loadingLabel.text = "辨識翻譯中..."
        loadingLabel.textColor = .white
        loadingLabel.font = .boldSystemFont(ofSize: 18)
        loadingLabel.textAlignment = .center
        loadingLabel.frame = CGRect(x: 0, y: processingView.bounds.midY + 20, width: processingView.bounds.width, height: 30)
        processingView.addSubview(loadingLabel)

        scanner.view.addSubview(processingView)

        let ocrResults = await self.performOCR(on: image)
        print("[GoSavor] 📷 OCR found \(ocrResults.count) text blocks")

        if ocrResults.isEmpty {
            processingView.removeFromSuperview()
            let emptyLabel = UILabel()
            emptyLabel.text = "未偵測到文字，請重試"
            emptyLabel.textColor = .white
            emptyLabel.font = .boldSystemFont(ofSize: 16)
            emptyLabel.backgroundColor = UIColor.red.withAlphaComponent(0.6)
            emptyLabel.layer.cornerRadius = 12
            emptyLabel.clipsToBounds = true
            emptyLabel.textAlignment = .center
            emptyLabel.frame = CGRect(x: 40, y: scanner.view.bounds.midY - 20, width: scanner.view.bounds.width - 80, height: 40)
            scanner.view.addSubview(emptyLabel)
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                emptyLabel.removeFromSuperview()
                try? scanner.startScanning()
            }
            return
        }

        let translations = await self.translateTexts(ocrResults.map { $0.0 })

        processingView.removeFromSuperview()
        self.showResult(on: scanner, image: image, ocrResults: ocrResults, translations: translations)

        // Auto-save to diary
        self.autoSaveToDiary()
    }

    // MARK: - Vision OCR (returns normalized rects 0-1, UIKit top-left origin)

    private func performOCR(on image: UIImage) async -> [(String, CGRect)] {
        guard let cgImage = image.cgImage else { return [] }

        // Convert UIImage orientation to CGImagePropertyOrientation for Vision
        let cgOrientation: CGImagePropertyOrientation
        switch image.imageOrientation {
        case .up: cgOrientation = .up
        case .down: cgOrientation = .down
        case .left: cgOrientation = .left
        case .right: cgOrientation = .right
        case .upMirrored: cgOrientation = .upMirrored
        case .downMirrored: cgOrientation = .downMirrored
        case .leftMirrored: cgOrientation = .leftMirrored
        case .rightMirrored: cgOrientation = .rightMirrored
        @unknown default: cgOrientation = .up
        }

        return await withCheckedContinuation { continuation in
            let request = VNRecognizeTextRequest { request, error in
                guard let observations = request.results as? [VNRecognizedTextObservation] else {
                    continuation.resume(returning: [])
                    return
                }

                var results: [(String, CGRect)] = []

                for obs in observations {
                    guard let candidate = obs.topCandidates(1).first else { continue }
                    let bb = obs.boundingBox
                    // Vision: bottom-left origin, normalized → UIKit: top-left origin, still normalized
                    let rect = CGRect(
                        x: bb.origin.x,
                        y: 1 - bb.origin.y - bb.height,
                        width: bb.width,
                        height: bb.height
                    )
                    results.append((candidate.string, rect))
                }

                continuation.resume(returning: results)
            }

            request.recognitionLanguages = ["ja", "en", "zh-Hant"]
            request.recognitionLevel = .accurate

            // Pass orientation so Vision maps coordinates correctly
            let handler = VNImageRequestHandler(cgImage: cgImage, orientation: cgOrientation, options: [:])
            DispatchQueue.global(qos: .userInitiated).async {
                try? handler.perform([request])
            }
        }
    }

    // MARK: - Translation (Apple Translate, numbered batch)

    private func translateTexts(_ texts: [String]) async -> [String] {
        guard #available(iOS 18.0, *) else { return texts }
        guard !texts.isEmpty else { return texts }

        // Use numbered format: "【1】text\n【2】text\n..." — Apple Translate preserves these markers
        var numbered = ""
        for (i, text) in texts.enumerated() {
            numbered += "【\(i+1)】\(text)\n"
        }

        let bridge = TranslationBridge()
        do {
            let result = try await bridge.translate(
                text: numbered,
                from: Locale.Language(identifier: "ja"),
                to: Locale.Language(identifier: targetLang)
            )

            // Parse result by 【n】 markers
            var parsed: [Int: String] = [:]
            let lines = result.components(separatedBy: "\n")
            var currentIdx = -1
            var currentText = ""

            for line in lines {
                // Check if line starts with 【n】
                if let range = line.range(of: "^【(\\d+)】", options: .regularExpression) {
                    // Save previous
                    if currentIdx > 0 {
                        parsed[currentIdx] = currentText.trimmingCharacters(in: .whitespacesAndNewlines)
                    }
                    let numStr = line[range].replacingOccurrences(of: "【", with: "").replacingOccurrences(of: "】", with: "")
                    currentIdx = Int(numStr) ?? -1
                    currentText = String(line[range.upperBound...])
                } else {
                    currentText += "\n" + line
                }
            }
            // Save last
            if currentIdx > 0 {
                parsed[currentIdx] = currentText.trimmingCharacters(in: .whitespacesAndNewlines)
            }

            // Build result array in order
            if parsed.count == texts.count {
                var results: [String] = []
                for i in 1...texts.count {
                    results.append(parsed[i] ?? texts[i-1])
                }
                print("[GoSavor] 📷 Batch translated \(texts.count) items")
                return results
            }

            // Fallback to individual if parsing failed
            print("[GoSavor] 📷 Batch parse mismatch (\(parsed.count) vs \(texts.count)), translating individually")
            return await translateIndividually(texts)
        } catch {
            print("[GoSavor] 📷 Batch translation error: \(error)")
            return texts
        }
    }

    @available(iOS 18.0, *)
    private func translateIndividually(_ texts: [String]) async -> [String] {
        var results: [String] = []
        for text in texts {
            let bridge = TranslationBridge()
            do {
                let result = try await bridge.translate(
                    text: text,
                    from: Locale.Language(identifier: "ja"),
                    to: Locale.Language(identifier: targetLang)
                )
                results.append(result)
            } catch {
                results.append(text)
            }
        }
        return results
    }

    // MARK: - Result display (split screen: zoomable photo + text list)

    private var ocrOriginals: [String] = []
    private var ocrTranslations: [String] = []
    private var textListContainer: UIView?
    private var textListScrollView: UIScrollView?
    private var arOverlayLabels: [UILabel] = []
    private var photoZoomScrollView: UIScrollView?
    private var zoomContentView: UIView?
    private var orderQuantities: [Int: Int] = [:] // idx → quantity
    private var orderFloatingBtn: UIButton?
    private var orderOverlay: UIView? // staff order view
    private var orderSynthesizer: AVSpeechSynthesizer? // keep alive during playback
    private var isMenuMode = false // true if OCR contains price patterns (¥, 円)

    private func showResult(on scanner: DataScannerViewController, image: UIImage, ocrResults: [(String, CGRect)], translations: [String]) {
        let screenW = UIScreen.main.bounds.width
        let screenH = UIScreen.main.bounds.height
        let safeTop: CGFloat = 54
        let toggleH: CGFloat = 50
        let photoH = (screenH - safeTop) * 0.5
        let toggleY = safeTop + photoH
        let textListY = toggleY + toggleH
        let textListH = screenH - textListY

        self.ocrOriginals = ocrResults.map { $0.0 }
        self.ocrTranslations = translations
        self.showingTranslation = true
        // Detect menu: if OCR text contains price patterns → show order buttons
        let allText = ocrResults.map { $0.0 }.joined()
        self.isMenuMode = allText.contains("¥") || allText.contains("￥") || allText.contains("円") || allText.range(of: #"\d+円"#, options: .regularExpression) != nil
        self.orderQuantities = [:]
        print("[GoSavor] Menu mode: \(isMenuMode)")
        self.arOverlayLabels = []

        let resultView = UIView(frame: scanner.view.bounds)
        resultView.backgroundColor = UIColor(red: 0.96, green: 0.96, blue: 0.96, alpha: 1)
        self.resultOverlay = resultView

        // ═══ TOP: Zoomable photo area ═══
        let photoArea = UIView(frame: CGRect(x: 0, y: 0, width: screenW, height: safeTop + photoH))
        photoArea.backgroundColor = .black
        photoArea.clipsToBounds = true
        resultView.addSubview(photoArea)

        // Content view sized to FILL the scroll area (no black bars)
        // Calculate fill dimensions: image scaled so it covers the entire view
        let imgAspect = image.size.width / image.size.height
        let viewAspect = screenW / photoH
        let contentW: CGFloat, contentH: CGFloat
        if imgAspect > viewAspect {
            // Image wider than view → fit by height, width overflows
            contentH = photoH
            contentW = photoH * imgAspect
        } else {
            // Image taller than view → fit by width, height overflows
            contentW = screenW
            contentH = screenW / imgAspect
        }

        // Zoom scroll view
        let zoomScroll = UIScrollView(frame: CGRect(x: 0, y: safeTop, width: screenW, height: photoH))
        zoomScroll.contentSize = CGSize(width: contentW, height: contentH)
        // Min zoom = fit entire image in view, default zoom = 1.0 = fill
        let fitZoom = min(screenW / contentW, photoH / contentH)
        zoomScroll.minimumZoomScale = fitZoom
        zoomScroll.maximumZoomScale = 4.0
        zoomScroll.zoomScale = 1.0
        zoomScroll.showsHorizontalScrollIndicator = false
        zoomScroll.showsVerticalScrollIndicator = false
        zoomScroll.bouncesZoom = true
        zoomScroll.delegate = self
        zoomScroll.tag = 600
        photoArea.addSubview(zoomScroll)
        self.photoZoomScrollView = zoomScroll

        // Content view matches fill dimensions
        let contentView = UIView(frame: CGRect(x: 0, y: 0, width: contentW, height: contentH))
        zoomScroll.addSubview(contentView)
        self.zoomContentView = contentView

        let imageView = UIImageView(image: image)
        imageView.contentMode = .scaleAspectFit
        imageView.frame = contentView.bounds
        contentView.addSubview(imageView)

        // Center scroll on image center
        let offsetX = max(0, (contentW - screenW) / 2)
        let offsetY = max(0, (contentH - photoH) / 2)
        zoomScroll.setContentOffset(CGPoint(x: offsetX, y: offsetY), animated: false)

        // AR overlays — displayRect = full contentView since it matches image aspect
        let displayRect = CGRect(x: 0, y: 0, width: contentW, height: contentH)

        let arContainer = UIView(frame: contentView.bounds)
        arContainer.isUserInteractionEnabled = true
        contentView.addSubview(arContainer)
        self.translationContainer = arContainer

        for i in 0..<ocrResults.count {
            let (_, normRect) = ocrResults[i]
            let translated = i < translations.count ? translations[i] : ocrResults[i].0

            let viewRect = CGRect(
                x: normRect.origin.x * displayRect.width,
                y: normRect.origin.y * displayRect.height,
                width: normRect.width * displayRect.width,
                height: normRect.height * displayRect.height
            )

            let label = UILabel()
            label.tag = 1000 + i
            label.text = translated
            label.numberOfLines = 0
            label.textColor = .white
            label.font = .boldSystemFont(ofSize: max(8, min(viewRect.height * 0.6, 20)))
            label.backgroundColor = UIColor(red: 0.1, green: 0.1, blue: 0.1, alpha: 0.55)
            label.layer.cornerRadius = 3
            label.layer.borderWidth = 0
            label.layer.borderColor = UIColor.orange.cgColor
            label.clipsToBounds = true
            label.textAlignment = .center
            label.adjustsFontSizeToFitWidth = true
            label.minimumScaleFactor = 0.3
            label.isUserInteractionEnabled = true
            label.frame = CGRect(
                x: viewRect.origin.x - 2,
                y: viewRect.origin.y - 1,
                width: viewRect.width + 4,
                height: viewRect.height + 2
            )

            let tap = UITapGestureRecognizer(target: self, action: #selector(arOverlayTapped(_:)))
            label.addGestureRecognizer(tap)

            arContainer.addSubview(label)
            arOverlayLabels.append(label)
        }

        // Close button (floats over photo, not in scroll)
        let closeBtn = UIButton(type: .system)
        closeBtn.setImage(UIImage(systemName: "xmark.circle.fill"), for: .normal)
        closeBtn.tintColor = .white
        closeBtn.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        closeBtn.layer.cornerRadius = 18
        closeBtn.frame = CGRect(x: 16, y: safeTop + 8, width: 36, height: 36)
        closeBtn.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        photoArea.addSubview(closeBtn)

        let retakeBtn = UIButton(type: .system)
        retakeBtn.setImage(UIImage(systemName: "camera.fill"), for: .normal)
        retakeBtn.tintColor = .white
        retakeBtn.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        retakeBtn.layer.cornerRadius = 18
        retakeBtn.frame = CGRect(x: screenW - 52, y: safeTop + 8, width: 36, height: 36)
        retakeBtn.addTarget(self, action: #selector(retakeTapped), for: .touchUpInside)
        photoArea.addSubview(retakeBtn)

        // Zoom hint
        let zoomHint = UILabel()
        zoomHint.text = "雙指縮放 · 拖動瀏覽"
        zoomHint.textColor = UIColor.white.withAlphaComponent(0.7)
        zoomHint.font = .systemFont(ofSize: 11)
        zoomHint.textAlignment = .center
        zoomHint.frame = CGRect(x: (screenW - 100) / 2, y: safeTop + photoH - 24, width: 100, height: 18)
        photoArea.addSubview(zoomHint)
        UIView.animate(withDuration: 0.5, delay: 2.5, options: [], animations: { zoomHint.alpha = 0 })

        // ═══ MIDDLE: Toggle + Save bar ═══
        let toggleBar = UIView(frame: CGRect(x: 0, y: toggleY, width: screenW, height: toggleH))
        toggleBar.backgroundColor = UIColor(red: 0.95, green: 0.6, blue: 0.1, alpha: 1)
        resultView.addSubview(toggleBar)

        let toggleBtn = UIButton(type: .system)
        toggleBtn.tag = 700
        toggleBtn.setTitle("👁 顯示原文", for: .normal)
        toggleBtn.titleLabel?.font = .boldSystemFont(ofSize: 15)
        toggleBtn.tintColor = .white
        toggleBtn.frame = CGRect(x: 16, y: 5, width: (screenW / 2) - 20, height: 40)
        toggleBtn.addTarget(self, action: #selector(toggleTapped), for: .touchUpInside)
        toggleBar.addSubview(toggleBtn)

        let saveBtn = UIButton(type: .system)
        saveBtn.tag = 710
        saveBtn.setTitle("💾 存入日記中...", for: .normal)
        saveBtn.titleLabel?.font = .boldSystemFont(ofSize: 15)
        saveBtn.tintColor = .white
        saveBtn.backgroundColor = UIColor.white.withAlphaComponent(0.2)
        saveBtn.layer.cornerRadius = 16
        saveBtn.frame = CGRect(x: (screenW / 2) + 4, y: 7, width: (screenW / 2) - 20, height: 36)
        saveBtn.addTarget(self, action: #selector(saveToDiaryTapped), for: .touchUpInside)
        toggleBar.addSubview(saveBtn)

        // ═══ BOTTOM: Text list ═══
        let listScroll = UIScrollView(frame: CGRect(x: 0, y: textListY, width: screenW, height: textListH))
        listScroll.backgroundColor = .white
        listScroll.showsVerticalScrollIndicator = true
        resultView.addSubview(listScroll)
        self.textListScrollView = listScroll

        let textContainer = UIView()
        listScroll.addSubview(textContainer)
        self.textListContainer = textContainer

        buildTextList(container: textContainer, width: screenW, showTranslated: true)

        scanner.view.addSubview(resultView)
        print("[GoSavor] 📷 Result displayed with \(ocrResults.count) blocks (zoomable)")
    }

    private func buildTextList(container: UIView, width: CGFloat, showTranslated: Bool) {
        container.subviews.forEach { $0.removeFromSuperview() }

        let padding: CGFloat = 16
        var y: CGFloat = 8
        let btnSize: CGFloat = 32

        for i in 0..<ocrOriginals.count {
            let original = ocrOriginals[i]
            let translated = i < ocrTranslations.count ? ocrTranslations[i] : original
            let textW = isMenuMode ? width - padding * 2 - 120 : width - padding * 2 - 16 // leave room for +/- buttons only in menu mode

            let card = UIView()
            card.tag = 2000 + i
            card.backgroundColor = UIColor(red: 0.97, green: 0.97, blue: 0.97, alpha: 1)
            card.layer.cornerRadius = 10
            card.isUserInteractionEnabled = true

            // Tap card → highlight AR overlay on photo
            let tap = UITapGestureRecognizer(target: self, action: #selector(cardTapped(_:)))
            card.addGestureRecognizer(tap)

            // Main text
            let mainLabel = UILabel()
            mainLabel.text = showTranslated ? translated : original
            mainLabel.numberOfLines = 0
            mainLabel.font = .systemFont(ofSize: 15)
            mainLabel.textColor = .black
            let mainSize = mainLabel.sizeThatFits(CGSize(width: textW, height: .greatestFiniteMagnitude))
            mainLabel.frame = CGRect(x: padding, y: 10, width: textW, height: max(mainSize.height, 18))
            card.addSubview(mainLabel)

            // Sub text (smaller, gray)
            let subLabel = UILabel()
            subLabel.text = showTranslated ? original : translated
            subLabel.numberOfLines = 0
            subLabel.font = .systemFont(ofSize: 12)
            subLabel.textColor = .gray
            let subSize = subLabel.sizeThatFits(CGSize(width: textW, height: .greatestFiniteMagnitude))
            subLabel.frame = CGRect(x: padding, y: mainLabel.frame.maxY + 4, width: textW, height: max(subSize.height, 14))
            card.addSubview(subLabel)

            let cardH = isMenuMode ? max(subLabel.frame.maxY + 10, btnSize + 20) : subLabel.frame.maxY + 10

            if isMenuMode {
                // Order quantity controls (right side)
                let qty = orderQuantities[i] ?? 0
                let controlY = (cardH - btnSize) / 2

                // Minus button
                let minusBtn = UIButton(type: .system)
                minusBtn.tag = 3000 + i
                minusBtn.setTitle("−", for: .normal)
                minusBtn.titleLabel?.font = .boldSystemFont(ofSize: 18)
                minusBtn.tintColor = qty > 0 ? .systemOrange : .lightGray
                minusBtn.backgroundColor = qty > 0 ? UIColor.systemOrange.withAlphaComponent(0.1) : UIColor(white: 0.9, alpha: 1)
                minusBtn.layer.cornerRadius = btnSize / 2
                minusBtn.frame = CGRect(x: width - padding * 2 - 110, y: controlY, width: btnSize, height: btnSize)
                minusBtn.addTarget(self, action: #selector(orderMinusTapped(_:)), for: .touchUpInside)
                card.addSubview(minusBtn)

                // Quantity label
                let qtyLabel = UILabel()
                qtyLabel.tag = 4000 + i
                qtyLabel.text = "\(qty)"
                qtyLabel.font = .boldSystemFont(ofSize: 16)
                qtyLabel.textColor = qty > 0 ? .systemOrange : .gray
                qtyLabel.textAlignment = .center
                qtyLabel.frame = CGRect(x: width - padding * 2 - 74, y: controlY, width: 30, height: btnSize)
                card.addSubview(qtyLabel)

                // Plus button
                let plusBtn = UIButton(type: .system)
                plusBtn.tag = 5000 + i
                plusBtn.setTitle("+", for: .normal)
                plusBtn.titleLabel?.font = .boldSystemFont(ofSize: 18)
                plusBtn.tintColor = .white
                plusBtn.backgroundColor = .systemOrange
                plusBtn.layer.cornerRadius = btnSize / 2
                plusBtn.frame = CGRect(x: width - padding * 2 - 40, y: controlY, width: btnSize, height: btnSize)
                plusBtn.addTarget(self, action: #selector(orderPlusTapped(_:)), for: .touchUpInside)
                card.addSubview(plusBtn)

                // Highlight card if has quantity
                if qty > 0 {
                    card.layer.borderWidth = 2
                    card.layer.borderColor = UIColor.systemOrange.cgColor
                }
            }

            card.frame = CGRect(x: padding, y: y, width: width - padding * 2, height: cardH)
            container.addSubview(card)

            y = card.frame.maxY + 6
        }

        y += 80 // extra space for floating button
        container.frame = CGRect(x: 0, y: 0, width: width, height: y)
        (container.superview as? UIScrollView)?.contentSize = CGSize(width: width, height: y)
    }

    // MARK: - Tap interactions

    @objc private func arOverlayTapped(_ gesture: UITapGestureRecognizer) {
        guard let label = gesture.view as? UILabel else { return }
        let idx = label.tag - 1000
        guard idx >= 0 && idx < ocrOriginals.count else { return }

        // Highlight this overlay
        flashHighlight(label)

        // Scroll bottom list to the corresponding card
        if let container = textListContainer,
           let card = container.viewWithTag(2000 + idx),
           let scroll = textListScrollView {
            let targetY = max(0, card.frame.origin.y - 10)
            scroll.setContentOffset(CGPoint(x: 0, y: targetY), animated: true)
            flashHighlight(card)
        }
    }

    @objc private func cardTapped(_ gesture: UITapGestureRecognizer) {
        guard let card = gesture.view else { return }
        let idx = card.tag - 2000
        guard idx >= 0 && idx < arOverlayLabels.count else { return }

        // Highlight the AR overlay on photo
        let overlay = arOverlayLabels[idx]
        flashHighlight(overlay)
        flashHighlight(card)

        // Zoom photo to show this overlay area
        if let zoomScroll = photoZoomScrollView, let contentView = zoomContentView {
            let overlayCenter = CGPoint(
                x: overlay.frame.midX,
                y: overlay.frame.midY
            )
            // Zoom to 2x centered on the overlay
            let zoomScale: CGFloat = 2.0
            let visibleW = zoomScroll.bounds.width / zoomScale
            let visibleH = zoomScroll.bounds.height / zoomScale
            let zoomRect = CGRect(
                x: overlayCenter.x - visibleW / 2,
                y: overlayCenter.y - visibleH / 2,
                width: visibleW,
                height: visibleH
            )
            zoomScroll.zoom(to: zoomRect, animated: true)
        }
    }

    private func flashHighlight(_ view: UIView) {
        let originalBorder = view.layer.borderWidth
        let originalColor = view.layer.borderColor
        view.layer.borderWidth = 2.5
        view.layer.borderColor = UIColor.orange.cgColor
        UIView.animate(withDuration: 0.3, delay: 1.0, options: [], animations: {
            view.layer.borderWidth = originalBorder
            view.layer.borderColor = originalColor
        })
    }

    private func aspectFitRect(imageSize: CGSize, viewSize: CGSize) -> CGRect {
        let imgAspect = imageSize.width / imageSize.height
        let viewAspect = viewSize.width / viewSize.height
        if imgAspect > viewAspect {
            let w = viewSize.width
            let h = w / imgAspect
            return CGRect(x: 0, y: (viewSize.height - h) / 2, width: w, height: h)
        } else {
            let h = viewSize.height
            let w = h * imgAspect
            return CGRect(x: (viewSize.width - w) / 2, y: 0, width: w, height: h)
        }
    }

    // MARK: - Order actions

    @objc private func orderPlusTapped(_ sender: UIButton) {
        let idx = sender.tag - 5000
        orderQuantities[idx] = (orderQuantities[idx] ?? 0) + 1
        rebuildOrderUI()
    }

    @objc private func orderMinusTapped(_ sender: UIButton) {
        let idx = sender.tag - 3000
        let current = orderQuantities[idx] ?? 0
        if current > 0 { orderQuantities[idx] = current - 1 }
        if orderQuantities[idx] == 0 { orderQuantities.removeValue(forKey: idx) }
        rebuildOrderUI()
    }

    private func rebuildOrderUI() {
        let screenW = UIScreen.main.bounds.width
        // Rebuild text list to update +/- highlights
        if let container = textListContainer {
            buildTextList(container: container, width: screenW, showTranslated: showingTranslation)
        }
        // Update floating order button
        let totalItems = orderQuantities.values.reduce(0, +)
        if totalItems > 0 {
            if orderFloatingBtn == nil {
                let btn = UIButton(type: .system)
                btn.backgroundColor = .systemOrange
                btn.layer.cornerRadius = 25
                btn.layer.shadowColor = UIColor.black.cgColor
                btn.layer.shadowOpacity = 0.3
                btn.layer.shadowOffset = CGSize(width: 0, height: 4)
                btn.layer.shadowRadius = 8
                btn.addTarget(self, action: #selector(showOrderView), for: .touchUpInside)
                resultOverlay?.addSubview(btn)
                orderFloatingBtn = btn
            }
            let screenH = UIScreen.main.bounds.height
            orderFloatingBtn?.setTitle("🛒 確認點餐（\(totalItems) 品）", for: .normal)
            orderFloatingBtn?.titleLabel?.font = .boldSystemFont(ofSize: 17)
            orderFloatingBtn?.tintColor = .white
            orderFloatingBtn?.frame = CGRect(x: 20, y: screenH - 120, width: screenW - 40, height: 50)
            orderFloatingBtn?.isHidden = false
        } else {
            orderFloatingBtn?.isHidden = true
        }
    }

    @objc private func showOrderView() {
        guard !orderQuantities.isEmpty else { return }
        let screenW = UIScreen.main.bounds.width
        let screenH = UIScreen.main.bounds.height

        let overlay = UIView(frame: CGRect(x: 0, y: 0, width: screenW, height: screenH))
        overlay.backgroundColor = UIColor(red: 0.08, green: 0.08, blue: 0.08, alpha: 1)
        self.orderOverlay = overlay

        // Header
        let header = UIView(frame: CGRect(x: 0, y: 0, width: screenW, height: 100))
        header.backgroundColor = UIColor(red: 0.12, green: 0.12, blue: 0.12, alpha: 1)
        overlay.addSubview(header)

        let title = UILabel(frame: CGRect(x: 20, y: 54, width: screenW - 80, height: 30))
        title.text = "注文 — \(orderQuantities.values.reduce(0, +)) 品"
        title.font = .boldSystemFont(ofSize: 22)
        title.textColor = .white
        header.addSubview(title)

        let closeBtn = UIButton(type: .system)
        closeBtn.setImage(UIImage(systemName: "xmark.circle.fill"), for: .normal)
        closeBtn.tintColor = .gray
        closeBtn.frame = CGRect(x: screenW - 50, y: 54, width: 30, height: 30)
        closeBtn.addTarget(self, action: #selector(closeOrderView), for: .touchUpInside)
        header.addSubview(closeBtn)

        // Order items scroll
        let scroll = UIScrollView(frame: CGRect(x: 0, y: 100, width: screenW, height: screenH - 230))
        scroll.backgroundColor = .clear
        overlay.addSubview(scroll)

        let container = UIView()
        scroll.addSubview(container)

        var y: CGFloat = 16
        let sorted = orderQuantities.sorted(by: { $0.key < $1.key })
        for (idx, qty) in sorted {
            guard qty > 0, idx < ocrOriginals.count else { continue }
            let original = ocrOriginals[idx]
            let translated = idx < ocrTranslations.count ? ocrTranslations[idx] : original

            let card = UIView(frame: CGRect(x: 16, y: y, width: screenW - 32, height: 70))
            card.backgroundColor = UIColor(red: 0.15, green: 0.15, blue: 0.15, alpha: 1)
            card.layer.cornerRadius = 12
            container.addSubview(card)

            let nameLabel = UILabel(frame: CGRect(x: 16, y: 10, width: screenW - 120, height: 28))
            nameLabel.text = original
            nameLabel.font = .boldSystemFont(ofSize: 22)
            nameLabel.textColor = .white
            nameLabel.adjustsFontSizeToFitWidth = true
            nameLabel.minimumScaleFactor = 0.5
            card.addSubview(nameLabel)

            let transLabel = UILabel(frame: CGRect(x: 16, y: 38, width: screenW - 120, height: 20))
            transLabel.text = translated
            transLabel.font = .systemFont(ofSize: 13)
            transLabel.textColor = .systemOrange
            card.addSubview(transLabel)

            let qtyBadge = UILabel(frame: CGRect(x: screenW - 80, y: 20, width: 36, height: 30))
            qtyBadge.text = "×\(qty)"
            qtyBadge.font = .boldSystemFont(ofSize: 20)
            qtyBadge.textColor = .systemOrange
            qtyBadge.textAlignment = .center
            card.addSubview(qtyBadge)

            y = card.frame.maxY + 8
        }

        container.frame = CGRect(x: 0, y: 0, width: screenW, height: y + 20)
        scroll.contentSize = container.frame.size

        // Play button
        let playBtn = UIButton(type: .system)
        playBtn.frame = CGRect(x: 20, y: screenH - 120, width: screenW - 40, height: 54)
        playBtn.backgroundColor = .systemOrange
        playBtn.layer.cornerRadius = 27
        playBtn.setTitle("▶ 播放日語點餐", for: .normal)
        playBtn.titleLabel?.font = .boldSystemFont(ofSize: 18)
        playBtn.tintColor = .white
        playBtn.addTarget(self, action: #selector(speakOrder), for: .touchUpInside)
        overlay.addSubview(playBtn)

        // Back button
        let backBtn = UIButton(type: .system)
        backBtn.frame = CGRect(x: 20, y: screenH - 60, width: screenW - 40, height: 40)
        backBtn.setTitle("← 返回修改", for: .normal)
        backBtn.titleLabel?.font = .systemFont(ofSize: 15)
        backBtn.tintColor = .gray
        backBtn.addTarget(self, action: #selector(closeOrderView), for: .touchUpInside)
        overlay.addSubview(backBtn)

        resultOverlay?.addSubview(overlay)
    }

    @objc private func closeOrderView() {
        orderOverlay?.removeFromSuperview()
        orderOverlay = nil
    }

    @objc private func speakOrder() {
        let sorted = orderQuantities.sorted(by: { $0.key < $1.key })
        var parts: [String] = []
        for (idx, qty) in sorted {
            guard qty > 0, idx < ocrOriginals.count else { continue }
            let name = ocrOriginals[idx]
            if qty == 1 {
                parts.append(name)
            } else {
                parts.append("\(name)を\(qty)つ")
            }
        }
        let orderText = parts.joined(separator: "、")
        let speech = "すみません、\(orderText)、お願いします"

        // Close order view first to free memory, then speak
        orderOverlay?.removeFromSuperview()
        orderOverlay = nil

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            do {
                try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
                try AVAudioSession.sharedInstance().setActive(true)
            } catch {
                print("[GoSavor] Audio session error: \(error)")
            }

            let utterance = AVSpeechUtterance(string: speech)
            utterance.voice = AVSpeechSynthesisVoice(language: "ja-JP")
            utterance.rate = 0.45
            utterance.preUtteranceDelay = 0.2
            self.orderSynthesizer = AVSpeechSynthesizer()
            self.orderSynthesizer?.speak(utterance)
        }
    }

    // MARK: - Actions

    @objc private func closeTapped() {
        DispatchQueue.main.async {
            // Resolve the start() call with result data (JS is awaiting this)
            if let data = self.lastResultData {
                self.startCall?.resolve([
                    "hasData": true,
                    "imageBase64": data["imageBase64"] ?? "",
                    "itemsJSON": data["itemsJSON"] ?? "[]",
                    "timestamp": data["timestamp"] ?? ""
                ])
            } else {
                self.startCall?.resolve(["hasData": false])
            }
            self.startCall = nil
            self.dismissAll()
        }
    }

    @objc private func retakeTapped() {
        DispatchQueue.main.async {
            self.resultOverlay?.removeFromSuperview()
            self.resultOverlay = nil
            self.translationContainer = nil
            self.textListContainer = nil
            self.textListScrollView = nil
            self.arOverlayLabels = []
            self.photoZoomScrollView = nil
            self.zoomContentView = nil
            self.orderQuantities = [:]
            self.orderFloatingBtn = nil
            self.orderOverlay = nil
            try? self.scannerVC?.startScanning()
        }
    }

    @objc private func toggleTapped() {
        showingTranslation.toggle()
        translationContainer?.isHidden = !showingTranslation

        // Update toggle button text
        if let btn = resultOverlay?.viewWithTag(700) as? UIButton {
            btn.setTitle(showingTranslation ? "👁 顯示原文" : "🔄 顯示譯文", for: .normal)
        }

        // Rebuild text list
        if let container = textListContainer {
            buildTextList(container: container, width: UIScreen.main.bounds.width, showTranslated: showingTranslation)
        }
    }

    private func autoSaveToDiary() {
        guard let image = capturedImage else { return }

        // Resize to max 800px for diary thumbnail (avoid huge base64 in event bridge)
        let maxDim: CGFloat = 800
        let scale = min(maxDim / image.size.width, maxDim / image.size.height, 1.0)
        let newSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        UIGraphicsBeginImageContextWithOptions(newSize, false, 1.0)
        image.draw(in: CGRect(origin: .zero, size: newSize))
        let resized = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()

        guard let jpegData = (resized ?? image).jpegData(compressionQuality: 0.6) else { return }
        let base64 = jpegData.base64EncodedString()
        print("[GoSavor] 📷 Diary image size: \(jpegData.count / 1024)KB")

        // Serialize items as JSON string
        var itemsList: [[String: String]] = []
        for i in 0..<ocrOriginals.count {
            itemsList.append([
                "original": ocrOriginals[i],
                "translated": i < ocrTranslations.count ? ocrTranslations[i] : ocrOriginals[i]
            ])
        }
        let itemsJSON: String
        if let jsonData = try? JSONSerialization.data(withJSONObject: itemsList),
           let jsonStr = String(data: jsonData, encoding: .utf8) {
            itemsJSON = jsonStr
        } else {
            itemsJSON = "[]"
        }

        // Store data for JS to fetch via getLastResult()
        self.lastResultData = [
            "imageBase64": base64,
            "itemsJSON": itemsJSON,
            "timestamp": String(Int(Date().timeIntervalSince1970 * 1000))
        ]

        // Signal JS (lightweight event, no heavy data)
        notifyListeners("arTranslateSaved", data: ["ready": true])
        print("[GoSavor] 📷 AR translate ready for save (\(ocrOriginals.count) items, img \(jpegData.count/1024)KB)")

        // Update button to show saved state
        if let btn = resultOverlay?.viewWithTag(710) as? UIButton {
            btn.setTitle("✅ 已存入日記", for: .normal)
            btn.isEnabled = false
            btn.backgroundColor = UIColor.green.withAlphaComponent(0.3)
        }
    }

    @objc private func saveToDiaryTapped() {
        // Already auto-saved, this is just visual feedback
        if let btn = resultOverlay?.viewWithTag(710) as? UIButton {
            btn.setTitle("✅ 已存入日記", for: .normal)
            btn.isEnabled = false
        }
    }

    private func dismissAll() {
        resultOverlay?.removeFromSuperview()
        resultOverlay = nil
        translationContainer = nil
        textListContainer = nil
        textListScrollView = nil
        arOverlayLabels = []
        photoZoomScrollView = nil
        zoomContentView = nil
        ocrOriginals = []
        ocrTranslations = []
        capturedImage = nil
        Task { @MainActor in
            self.scannerVC?.stopScanning()
            self.scannerVC?.dismiss(animated: true)
            self.scannerVC = nil
        }
    }

    private func handlePickedImage(_ image: UIImage, result: PHPickerResult) {
        print("[GoSavor] pickImage: full-res image \(image.size)")

        // If from pickImage call → return base64
        if let call = self.pickImageCall {
            guard let jpegData = image.jpegData(compressionQuality: 0.85) else {
                call.resolve(["cancelled": true])
                self.pickImageCall = nil
                return
            }
            call.resolve([
                "cancelled": false,
                "base64": jpegData.base64EncodedString(),
            ])
            self.pickImageCall = nil
            return
        }

        // Otherwise from AR translate flow
        Task { @MainActor in
            self.scannerVC?.stopScanning()
            await self.processImage(image)
        }
    }
}

// MARK: - PHPickerViewControllerDelegate (album photo selection)
@available(iOS 16.0, *)
extension LiveTranslatePlugin: PHPickerViewControllerDelegate {
    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)

        guard let result = results.first else {
            // Cancelled — check if from pickImage
            pickImageCall?.resolve(["cancelled": true])
            pickImageCall = nil
            return
        }
        guard result.itemProvider.canLoadObject(ofClass: UIImage.self) else { return }

        // Use loadFileRepresentation to get FULL resolution image file
        result.itemProvider.loadFileRepresentation(forTypeIdentifier: "public.image") { [weak self] url, error in
            guard let self = self else { return }
            if let url = url, let data = try? Data(contentsOf: url), let image = UIImage(data: data) {
                print("[GoSavor] pickImage via file: \(image.size)")
                self.handlePickedImage(image, result: result)
            } else {
                // Fallback: try loadObject
                result.itemProvider.loadObject(ofClass: UIImage.self) { [weak self] object, _ in
                    guard let self = self, let image = object as? UIImage else {
                        self?.pickImageCall?.resolve(["cancelled": true])
                        self?.pickImageCall = nil
                        return
                    }
                    print("[GoSavor] pickImage via object fallback: \(image.size)")
                    self.handlePickedImage(image, result: result)
                }
            }
        }
    }
}

// MARK: - UIImagePickerControllerDelegate (camera for pickImage)
@available(iOS 16.0, *)
extension LiveTranslatePlugin {
    public func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        picker.dismiss(animated: true)
        guard let image = info[.originalImage] as? UIImage,
              let jpegData = image.jpegData(compressionQuality: 0.8) else {
            pickImageCall?.resolve(["cancelled": true])
            pickImageCall = nil
            return
        }
        pickImageCall?.resolve([
            "cancelled": false,
            "base64": jpegData.base64EncodedString(),
        ])
        pickImageCall = nil
    }

    public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        pickImageCall?.resolve(["cancelled": true])
        pickImageCall = nil
    }
}

// MARK: - UIScrollViewDelegate (photo zoom)
@available(iOS 16.0, *)
extension LiveTranslatePlugin: UIScrollViewDelegate {
    public func viewForZooming(in scrollView: UIScrollView) -> UIView? {
        // Only handle the photo zoom scroll (tag 600), not the text list
        if scrollView.tag == 600 {
            return zoomContentView
        }
        return nil
    }
}
