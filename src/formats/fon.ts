// Copyright 2022 Harold project contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { assert } from '../util.js'
import struct from './struct.js'

const fonHeader = struct('<iiiii')
const headerSize = 5 * 4
const fonSymbolInfo = struct('<ii')

interface SymbolInfo {
    width: number
    offset: number
}

export interface Font {
    filepath: string
    symbols: SymbolInfo[]
    height: number
    spacing: number
    textureData: Uint8Array
}

function fontDataSize(width: number, height: number): number {
    return Math.floor((width + 7) / 8) * height
}

export async function fonUnpack(filepath: string): Promise<Font> {
    const response = await fetch(filepath)
    const buffer = await response.arrayBuffer()

    const [numSymbols, height, spacing] = fonHeader.unpack(buffer)
    const symbols: SymbolInfo[] = []

    const lastInfoIndex = numSymbols - 1
    const [lastWidth, lastOffset] = fonSymbolInfo.unpack_from(buffer, headerSize + lastInfoIndex * 8)
    const bitmapSize = fontDataSize(lastWidth, height) + lastOffset
    const bitmapView = new DataView(buffer)
    const dataOffset = buffer.byteLength - bitmapSize - 1

    // First pass over all symbols to calculate width correctly.
    for (let i = 0; i < numSymbols; ++i) {
        const [width, offset] = fonSymbolInfo.unpack_from(buffer, headerSize + i * 8)
        const length = fontDataSize(width, height)

        if (length == 0) {
            symbols.push({ width, offset })
            continue
        }

        symbols.push({ width, offset })
    }

    const totalWidth = symbols.reduce((accumulator, sym) => accumulator + sym.width, 0)

    // Each bit in the bitmap will be expanded to a byte (8 bits) in the texture, since WebGL textures don't support 1-bit depth.
    const textureData = new Uint8Array(totalWidth * height)

    // Second pass to populate texture data.
    let currentSymbolOffset = 0
    for (const symbol of symbols) {
        const widthInBytes = fontDataSize(symbol.width, height) / height

        for (let h = 0; h < height; ++h) {
            for (let w = 0; w < symbol.width; ++w) {
                const bitmapPixelIndex = dataOffset + symbol.offset + h * widthInBytes + Math.floor(w / 8)
                const pixelIsEmpty = (bitmapView.getUint8(bitmapPixelIndex) & (1 << (7 - (w % 8)))) == 0

                const texturePixelIndex = currentSymbolOffset + w + h * totalWidth
                if (!pixelIsEmpty) {
                    textureData[texturePixelIndex] = 255
                }
            }
        }

        currentSymbolOffset += symbol.width
    }

    return { filepath, symbols, height, spacing, textureData }
}
