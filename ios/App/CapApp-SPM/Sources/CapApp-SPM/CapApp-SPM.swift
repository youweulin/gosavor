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

        DispatchQueue.global(qos: .userInitiated).async {
            let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up)
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

// MARK: - LiveTranslate Plugin (AR-like real-time translation)
import VisionKit

@available(iOS 16.0, *)
@objc(LiveTranslatePlugin)
public class LiveTranslatePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveTranslatePlugin"
    public let jsName = "LiveTranslate"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise)
    ]

    private var scannerVC: DataScannerViewController?
    private var translationSession: Any? // TranslationSession (iOS 18+)

    override public func load() {
        print("[GoSavor] ✅ LiveTranslatePlugin loaded!")
    }

    @objc func isSupported(_ call: CAPPluginCall) {
        let supported = DataScannerViewController.isSupported && DataScannerViewController.isAvailable
        call.resolve(["supported": supported])
    }

    @objc func start(_ call: CAPPluginCall) {
        let targetLang = call.getString("targetLang") ?? "zh-Hant"

        guard DataScannerViewController.isSupported && DataScannerViewController.isAvailable else {
            call.reject("DataScanner not supported on this device")
            return
        }

        DispatchQueue.main.async {
            let scanner = DataScannerViewController(
                recognizedDataTypes: [.text()],
                qualityLevel: .accurate,
                recognizesMultipleItems: true,
                isHighFrameRateTrackingEnabled: true,
                isHighlightingEnabled: true
            )

            scanner.delegate = self

            // Add close button overlay
            let closeButton = UIButton(type: .system)
            closeButton.setImage(UIImage(systemName: "xmark.circle.fill"), for: .normal)
            closeButton.tintColor = .white
            closeButton.backgroundColor = UIColor.black.withAlphaComponent(0.5)
            closeButton.layer.cornerRadius = 22
            closeButton.frame = CGRect(x: 20, y: 60, width: 44, height: 44)
            closeButton.addTarget(self, action: #selector(self.closeScannerTapped), for: .touchUpInside)
            scanner.view.addSubview(closeButton)

            // Add "Live Translate" label
            let label = UILabel()
            label.text = "📷 即時翻譯"
            label.textColor = .white
            label.font = .boldSystemFont(ofSize: 16)
            label.backgroundColor = UIColor.black.withAlphaComponent(0.5)
            label.layer.cornerRadius = 12
            label.clipsToBounds = true
            label.textAlignment = .center
            label.frame = CGRect(x: (UIScreen.main.bounds.width - 140) / 2, y: 60, width: 140, height: 36)
            scanner.view.addSubview(label)

            // Add translation overlay label at bottom
            let translationLabel = UILabel()
            translationLabel.tag = 999
            translationLabel.numberOfLines = 0
            translationLabel.textColor = .white
            translationLabel.font = .boldSystemFont(ofSize: 18)
            translationLabel.backgroundColor = UIColor.black.withAlphaComponent(0.7)
            translationLabel.layer.cornerRadius = 16
            translationLabel.clipsToBounds = true
            translationLabel.textAlignment = .center
            let bottomY = UIScreen.main.bounds.height - 200
            translationLabel.frame = CGRect(x: 20, y: bottomY, width: UIScreen.main.bounds.width - 40, height: 120)
            translationLabel.text = "對準文字自動翻譯..."
            scanner.view.addSubview(translationLabel)

            self.scannerVC = scanner

            // Setup translation session for iOS 18+
            if #available(iOS 18.0, *) {
                self.setupTranslation(targetLang: targetLang)
            }

            // Present scanner
            if let rootVC = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .flatMap({ $0.windows })
                .first(where: { $0.isKeyWindow })?.rootViewController {
                rootVC.present(scanner, animated: true) {
                    try? scanner.startScanning()
                    print("[GoSavor] 📷 LiveTranslate started")
                }
            }

            call.resolve(["success": true])
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.scannerVC?.stopScanning()
            self.scannerVC?.dismiss(animated: true)
            self.scannerVC = nil
            print("[GoSavor] 📷 LiveTranslate stopped")
            call.resolve(["success": true])
        }
    }

    @objc private func closeScannerTapped() {
        scannerVC?.stopScanning()
        scannerVC?.dismiss(animated: true)
        scannerVC = nil
        notifyListeners("liveTranslateClosed", data: [:])
    }

    @available(iOS 18.0, *)
    private func setupTranslation(targetLang: String) {
        // We'll use the TranslationBridge for translation
        print("[GoSavor] Translation target: \(targetLang)")
    }

    private func translateAndDisplay(text: String) {
        guard !text.isEmpty else { return }

        if #available(iOS 18.0, *) {
            Task { @MainActor in
                let bridge = TranslationBridge()
                do {
                    let result = try await bridge.translate(
                        text: text,
                        from: Locale.Language(identifier: "ja"),
                        to: Locale.Language(identifier: "zh-Hant")
                    )
                    // Update the overlay label
                    if let label = self.scannerVC?.view.viewWithTag(999) as? UILabel {
                        label.text = "\(text)\n→ \(result)"
                    }
                    print("[GoSavor] 📷 Live: \(text.prefix(20)) → \(result.prefix(20))")
                } catch {
                    print("[GoSavor] 📷 Translation error: \(error)")
                    if let label = self.scannerVC?.view.viewWithTag(999) as? UILabel {
                        label.text = text
                    }
                }
            }
        } else {
            // iOS < 18: just show original text
            DispatchQueue.main.async {
                if let label = self.scannerVC?.view.viewWithTag(999) as? UILabel {
                    label.text = text
                }
            }
        }
    }
}

@available(iOS 16.0, *)
extension LiveTranslatePlugin: DataScannerViewControllerDelegate {
    public func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
        // Collect all text items
        let texts = allItems.compactMap { item -> String? in
            if case .text(let text) = item {
                return text.transcript
            }
            return nil
        }
        let combined = texts.joined(separator: "\n")
        if !combined.isEmpty {
            translateAndDisplay(text: combined)
        }
    }

    public func dataScanner(_ dataScanner: DataScannerViewController, didUpdate updatedItems: [RecognizedItem], allItems: [RecognizedItem]) {
        let texts = allItems.compactMap { item -> String? in
            if case .text(let text) = item {
                return text.transcript
            }
            return nil
        }
        let combined = texts.joined(separator: "\n")
        if !combined.isEmpty {
            translateAndDisplay(text: combined)
        }
    }
}
