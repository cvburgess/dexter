// Re-encode a PNG without an alpha channel, for App Store screenshots.
//
// App Store Connect rejects screenshots that carry an alpha channel, and
// `xcrun simctl io <udid> screenshot` always emits RGBA. `sips` cannot strip
// it — it re-adds alpha on every PNG export — so this redraws the image into
// an opaque RGB bitmap via CoreGraphics. No external dependencies: Xcode is
// already required to run the simulator these screenshots come from.
//
//   swift scripts/flatten-screenshot.swift raw.png out.png
//
// See docs/appstore.md for the full capture procedure.

import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

func fail(_ message: String) -> Never {
  FileHandle.standardError.write("flatten-screenshot: \(message)\n".data(using: .utf8)!)
  exit(1)
}

let args = CommandLine.arguments
guard args.count == 3 else {
  FileHandle.standardError.write(
    "usage: swift scripts/flatten-screenshot.swift <in.png> <out.png>\n".data(using: .utf8)!)
  exit(2)
}

guard let data = NSData(contentsOfFile: args[1]),
      let source = CGImageSourceCreateWithData(data, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
else { fail("cannot read \(args[1])") }

let width = image.width
let height = image.height

guard let ctx = CGContext(
  data: nil, width: width, height: height,
  bitsPerComponent: 8, bytesPerRow: 0,
  space: CGColorSpaceCreateDeviceRGB(),
  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
) else { fail("cannot create \(width)x\(height) RGB context") }

// Composite onto opaque white so any translucent pixels resolve deterministically
// rather than inheriting whatever the encoder assumes.
ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))

guard let flattened = ctx.makeImage() else { fail("cannot render flattened image") }
guard let dest = CGImageDestinationCreateWithURL(
  URL(fileURLWithPath: args[2]) as CFURL, UTType.png.identifier as CFString, 1, nil
) else { fail("cannot open \(args[2]) for writing") }

CGImageDestinationAddImage(dest, flattened, nil)
guard CGImageDestinationFinalize(dest) else { fail("cannot encode \(args[2])") }
