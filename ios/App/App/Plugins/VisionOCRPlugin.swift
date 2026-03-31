import Foundation
import Capacitor
import Vision
import UIKit

@objc(VisionOCRPlugin)
public class VisionOCRPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VisionOCRPlugin"
    public let jsName = "VisionOCR"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recognizeText", returnType: CAPPluginReturnPromise)
    ]

    @objc func recognizeText(_ call: CAPPluginCall) {
        guard let base64String = call.getString("imageBase64") else {
            call.reject("Missing imageBase64 parameter")
            return
        }

        // Remove data URL prefix if present
        let cleanBase64 = base64String
            .replacingOccurrences(of: "data:image/jpeg;base64,", with: "")
            .replacingOccurrences(of: "data:image/png;base64,", with: "")

        guard let imageData = Data(base64Encoded: cleanBase64),
              let uiImage = UIImage(data: imageData),
              let cgImage = uiImage.cgImage else {
            call.reject("Invalid image data")
            return
        }

        let languages = call.getArray("languages", String.self) ?? ["ja", "en"]

        let request = VNRecognizeTextRequest { request, error in
            if let error = error {
                call.reject("Vision error: \(error.localizedDescription)")
                return
            }

            guard let observations = request.results as? [VNRecognizedTextObservation] else {
                call.resolve(["items": []])
                return
            }

            var items: [[String: Any]] = []

            for observation in observations {
                guard let text = observation.topCandidates(1).first?.string else { continue }
                let box = observation.boundingBox

                // Convert from Vision coords (bottom-left origin, 0-1) to top-left origin (0-1000)
                let ymin = Int((1 - box.origin.y - box.height) * 1000)
                let xmin = Int(box.origin.x * 1000)
                let ymax = Int((1 - box.origin.y) * 1000)
                let xmax = Int((box.origin.x + box.width) * 1000)

                items.append([
                    "text": text,
                    "boundingBox": [ymin, xmin, ymax, xmax],
                    "confidence": observation.confidence
                ])
            }

            call.resolve(["items": items])
        }

        request.recognitionLanguages = languages
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true

        DispatchQueue.global(qos: .userInitiated).async {
            let handler = VNImageRequestHandler(cgImage: cgImage)
            try? handler.perform([request])
        }
    }
}
