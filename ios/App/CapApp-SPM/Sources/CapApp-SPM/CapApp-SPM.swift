import Foundation
import Capacitor
import Vision
import UIKit
import AVFoundation
import Speech
// Translation framework requires SwiftUI — using Gemini fallback for now

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
        utterance.voice = AVSpeechSynthesisVoice(language: lang)
        utterance.rate = rate
        utterance.pitchMultiplier = pitch

        // Prefer premium/enhanced voice
        if let voices = AVSpeechSynthesisVoice.speechVoices() as? [AVSpeechSynthesisVoice] {
            let premium = voices.filter { $0.language.starts(with: lang.prefix(2)) && $0.quality == .enhanced }
            if let best = premium.first {
                utterance.voice = best
                print("[GoSavor] Using enhanced voice: \(best.name)")
            }
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
        // Apple Translation framework is SwiftUI-only (needs .translationTask modifier)
        // For now, return empty and let JS fallback to Gemini
        print("[GoSavor] translate called: \(text.prefix(30))... (delegating to Gemini)")
        call.resolve(["translated": "", "engine": "unavailable"])
    }
}
