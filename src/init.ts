/*
Copyright 2014 darkf

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { Config } from './config.js'
import { CriticalEffects } from './criticalEffects.js'
import { Events } from './events.js'
import { Point } from './geometry.js'
import globalState from './globalState.js'
import { GameMap } from './map.js'
import { Player } from './player.js'
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './renderer.js'
import { SaveLoad } from './saveload.js'
import { initUI, uiLog } from './ui.js'
import { Worldmap } from './worldmap.js'

export function initGame() {
    // initialize player
    globalState.player = new Player()

    // initialize map
    globalState.gMap = new GameMap()

    uiLog('Welcome to DarkFO')

    if (location.search !== '') {
        // load map from query string (e.g. URL ending in ?modmain)
        // also check if it's trying to connect to a remote server

        const query = location.search.slice(1)

        globalState.gMap.loadMap(location.search.slice(1))
    } // load starting map
    else globalState.gMap.loadMap('artemple')

    if (Config.engine.doCombat === true) CriticalEffects.loadTable()

    document.oncontextmenu = () => false
    const $cnv = document.getElementById('cnv')!
    $cnv.onmouseenter = () => {
        globalState.gameHasFocus = true
    }
    $cnv.onmouseleave = () => {
        globalState.gameHasFocus = false
    }

    globalState.tempCanvas = document.createElement('canvas') as HTMLCanvasElement
    globalState.tempCanvas.width = SCREEN_WIDTH
    globalState.tempCanvas.height = SCREEN_HEIGHT
    globalState.tempCanvasCtx = globalState.tempCanvas.getContext('2d')

    SaveLoad.init()

    Worldmap.init()

    initUI()

    if (Config.ui.hideRoofWhenUnder) {
        // Only show roofs if the player is not under them
        Events.on('playerMoved', (e: Point) => {
            Config.ui.showRoof = !globalState.gMap.hasRoofAt(e)
        })
    }
}
