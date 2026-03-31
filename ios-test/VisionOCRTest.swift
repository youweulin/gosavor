// Quick test: Apple Vision OCR accuracy
// Run: swift VisionOCRTest.swift <image_path>

import Vision
import AppKit
import Foundation

guard CommandLine.arguments.count > 1 else {
    print("Usage: swift VisionOCRTest.swift <image_path>")
    exit(1)
}

let imagePath = CommandLine.arguments[1]
guard let image = NSImage(contentsOfFile: imagePath),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("Cannot load image: \(imagePath)")
    exit(1)
}

let request = VNRecognizeTextRequest { request, error in
    guard let observations = request.results as? [VNRecognizedTextObservation] else { return }
    
    print("Found \(observations.count) text regions\n")
    
    for (i, observation) in observations.enumerated() {
        let text = observation.topCandidates(1).first?.string ?? ""
        let box = observation.boundingBox
        
        // Vision uses bottom-left origin, convert to top-left (0-1000 scale)
        let ymin = Int((1 - box.origin.y - box.height) * 1000)
        let xmin = Int(box.origin.x * 1000)
        let ymax = Int((1 - box.origin.y) * 1000)
        let xmax = Int((box.origin.x + box.width) * 1000)
        
        print("\(i+1). \"\(text)\"")
        print("   BoundingBox: [\(ymin), \(xmin), \(ymax), \(xmax)]")
        print("   Confidence: \(observation.confidence)")
        print("")
    }
}

request.recognitionLanguages = ["ja", "en"]
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cgImage)
try! handler.perform([request])
