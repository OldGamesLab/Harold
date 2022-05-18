// Copyright 2014-2022 darkf
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

import globalState from './globalState.js'
import { Config } from './config.js'

export function lazyLoadImage(art: string, callback?: (x: HTMLImageElement) => void) {
    if (globalState.images[art] !== undefined) {
        if (callback) {
            callback(globalState.images[art])
        }
        return
    }

    if (globalState.lazyAssetLoadingQueue[art] !== undefined) {
        if (callback) {
            globalState.lazyAssetLoadingQueue[art].push(callback)
        }
        return
    }

    if (Config.engine.doLogLazyLoads) {
        console.log('lazy loading ' + art + '...')
    }

    globalState.lazyAssetLoadingQueue[art] = callback ? [callback] : []

    const img = new Image()
    img.onload = function () {
        globalState.images[art] = img
        const callbacks = globalState.lazyAssetLoadingQueue[art]
        if (callbacks !== undefined) {
            for (let i = 0; i < callbacks.length; i++) {
                callbacks[i](globalState.images[art])
            }
            globalState.lazyAssetLoadingQueue[art] = undefined
        }
    }
    img.src = art + '.png'
}
