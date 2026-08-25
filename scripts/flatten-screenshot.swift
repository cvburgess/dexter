// Re-encode a PNG without an alpha channel, optionally rotating it, for App
// Store screenshots.
//
// App Store Connect rejects screenshots that carry an alpha channel, and
// `xcrun simctl io <udid> screenshot` always emits RGBA. `sips` cannot strip
// it — it re-adds alpha on every PNG export — so this redraws the image into
// an opaque RGB bitmap via CoreGraphics. No external dependencies: Xcode is
// already required to run the simulator these screenshots come from.
//
// Rotation lives here for the same reason: `simctl` captures the *native*
// portrait framebuffer even when the device is in landscape, handing back a
// portrait canvas with the content turned 90°. Rotating with `sips -r` first
// would re-add the alpha channel this script exists to remove, so both happen
// in one pass.
//
//   swift scripts/flatten-screenshot.swift raw.png out.png
//   swift scripts/flatten-screenshot.swift raw.png out.png --rotate-ccw
//
// See scripts/screenshots/README.md for the full capture procedure.

import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

func fail(_ message: String) -> Never {
  FileHandle.standardError.write("flatten-screenshot: \(message)\n".data(using: .utf8)!)
  exit(1)
}

func usage() -> Never {
  FileHandle.standardError.write(
    "usage: swift scripts/flatten-screenshot.swift <in.png> <out.png> [--rotate-ccw|--rotate-cw]\n"
      .data(using: .utf8)!)
  exit(2)
}

let args = CommandLine.arguments
guard args.count == 3 || args.count == 4 else { usage() }

enum Rotation {
  case none, ccw, cw
}

var rotation = Rotation.none
if args.count == 4 {
  switch args[3] {
  case "--rotate-ccw": rotation = .ccw
  case "--rotate-cw": rotation = .cw
  default: usage()
  }
}

guard let data = NSData(contentsOfFile: args[1]),
      let source = CGImageSourceCreateWithData(data, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
else { fail("cannot read \(args[1])") }

let inWidth = image.width
let inHeight = image.height

// A quarter turn swaps the canvas.
let quarterTurn = rotation != .none
let width = quarterTurn ? inHeight : inWidth
let height = quarterTurn ? inWidth : inHeight

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

if quarterTurn {
  // Rotate about the canvas centre, then draw the source centred on it.
  // CGContext draws a CGImage flipped relative to its own y-up space, so the
  // sign here is the opposite of the one the names suggest: a *positive* angle
  // is what lands as a counter-clockwise turn in the saved PNG. Verified
  // against a known-good `sips -r -90` render rather than reasoned about.
  ctx.translateBy(x: CGFloat(width) / 2, y: CGFloat(height) / 2)
  ctx.rotate(by: rotation == .ccw ? .pi / 2 : -.pi / 2)
  ctx.draw(
    image,
    in: CGRect(
      x: -CGFloat(inWidth) / 2, y: -CGFloat(inHeight) / 2,
      width: CGFloat(inWidth), height: CGFloat(inHeight)))
} else {
  ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
}

guard let flattened = ctx.makeImage() else { fail("cannot render flattened image") }
guard let dest = CGImageDestinationCreateWithURL(
  URL(fileURLWithPath: args[2]) as CFURL, UTType.png.identifier as CFString, 1, nil
) else { fail("cannot open \(args[2]) for writing") }

CGImageDestinationAddImage(dest, flattened, nil)
guard CGImageDestinationFinalize(dest) else { fail("cannot encode \(args[2])") }
