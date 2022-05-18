/* heart.js v0.0.1
   copyright (c) 2012 darkf
   licensed under the terms of the MIT license, see LICENSE for details

   A Canvas-based graphics library inspired by (i.e. cloned from) Love 2D (https://love2d.org/)
   It's currently in its pre-alpha development stage, so don't expect anything to work,
   and feel free to send pull requests / file issues!

   Thank you for using heart.js! :-)
*/

type MouseButton = 'l' | 'm' | 'r' | 'unknown'

class Timer {
    getFPS() {
        return heart._fps
    }

    getTargetFPS() {
        return heart._targetFPS
    }

    setTargetFPS(fps: number) {
        heart._targetFPS = fps
        heart._targetTickTime = 1000 / heart._targetFPS
    }

    getTime() {
        return window.performance.now()
    }
}

class Graphics {
    rectangle(mode: string, x: number, y: number, w: number, h: number) {
        if (mode === 'fill') {
            heart.ctx.fillRect(x, y, w, h)
        } else {
            heart.ctx.strokeRect(x, y, w, h)
        }
    }

    circle(mode: string, x: number, y: number, radius: number) {
        heart.ctx.beginPath()
        heart.ctx.arc(x, y, radius, 0, Math.PI * 2, false)
        if (mode === 'fill') {
            heart.ctx.fill()
        } else {
            heart.ctx.stroke()
        }
    }

    line(x1: number, y1: number, x2: number, y2: number) {
        heart.ctx.beginPath()
        heart.ctx.moveTo(x1, y1)
        heart.ctx.lineTo(x2, y2)
        heart.ctx.stroke()
    }

    print(text: string, x: number, y: number) {
        heart.ctx.fillText(text, x, y)
    }

    setColor(r: number, g: number, b: number, a: number) {
        if (a === undefined) {
            heart.ctx.fillStyle = heart.ctx.strokeStyle = 'rgb(' + r + ',' + g + ',' + b + ')'
        } else {
            const alpha = (a / 255).toFixed(1) // input is in 0..255, output is in 0.0..1.0
            heart.ctx.fillStyle = heart.ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')'
        }
    }

    getWidth() {
        return heart._size.w
    }

    getHeight() {
        return heart._size.h
    }

    getBackgroundColor() {
        return heart._bg
    }

    setBackgroundColor(r: number, g: number, b: number) {
        heart._bg = { r: r, g: g, b: b }
    }

    newImage(src: string, callback: (img: HTMLImageElement) => void) {
        /* load an image */
        /* XXX: does not handle errors */
        const img = new Image()
        heart._imagesLoading.push(img)
        img.onload = function () {
            heart._imagesLoading.splice(heart._imagesLoading.indexOf(img), 1) /* remove img from the loading sequence */
            callback(img)
        }
        img.src = src
    }

    draw(drawable: HTMLImageElement, x: number, y: number) {
        if (drawable !== undefined) {
            heart.ctx.drawImage(drawable, x, y)
        }
    }

    translate(x: number, y: number) {
        heart.ctx.translate(x, y)
    }

    rotate(angle: number) {
        heart.ctx.rotate(angle)
    }

    push() {
        heart.ctx.save()
    }

    pop() {
        heart.ctx.restore()
    }
}

class Keyboard {
    isDown(key: string) {
        return heart._keysDown[key]
    }

    isUp(key: string) {
        return !this.isDown(key)
    }
}

class Mouse {
    _pos = { x: 0, y: 0 }
    _btnState = { l: false, m: false, r: false, unknown: false } /* left and right button press state */

    getPosition(): number[] {
        return [this._pos.x, this._pos.y]
    }

    getX() {
        return this._pos.x
    }

    getY() {
        return this._pos.y
    }

    isDown(button: MouseButton) {
        return this._btnState[button] !== undefined ? this._btnState[button] : false
    }
}

class Heart {
    _lastTick: number | undefined = undefined /* time of the last tick */
    _dt = 0 /* time since last tick in seconds */
    _fps = 0 /* frames per second */
    _frameAccum = 0 /* time accumulated between frames */
    _targetFPS = 30 /* the target FPS cap */
    _targetTickTime: number | undefined = undefined /* 1000 / _targetFPS (milliseconds to aim for) */
    _numFrames = 0 /* used for FPS counting (number of frames since last FPS count) */
    _lastFPSTime = 0 /* used for FPS counting (time the last FPS count was done) */
    _bg = { r: 127, g: 127, b: 127 } /* background color */
    _size = { w: 800, h: 600 } /* size of viewport */
    _imagesLoading: HTMLImageElement[] = [] /* for synchronous image loading */
    _keysDown: { [name: string]: boolean } = {} /* which keys are down (char -> bool) */
    _canvasOffset = { x: 0, y: 0 } /* offset of the canvas relative to the document */

    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D | undefined
    graphics: Graphics = new Graphics()
    mouse: Mouse = new Mouse()
    keyboard = new Keyboard()
    timer = new Timer()

    keydown: (key: string) => void
    keypressed: (key: string) => void
    keyup: (key: string) => void
    keyreleased: (key: string) => void
    mousemoved: (x: number, y: number) => void
    mousepressed: (x: number, y: number, btn: MouseButton) => void
    mousereleased: (x: number, y: number, btn: MouseButton) => void
    update: (time: number) => void
    draw: () => void
    focus: (isFocused: boolean) => void

    _init() {
        /* if we're waiting on images to load, spinlock */
        if (heart._imagesLoading.length !== 0) {
            setTimeout(heart._init, 30 /* ms */)
            return
        }

        if (heart.canvas === undefined || heart.ctx === undefined) {
            alert('no canvas')
        }

        const rect = heart.canvas.getBoundingClientRect()
        heart._canvasOffset.x = rect.left
        heart._canvasOffset.y = rect.top

        /* register for mouse-related events (pertaining to the canvas) */
        heart.canvas.onmousedown = (e) => {
            const btn = heart._mouseButtonName(e.which)
            this.mouse._btnState[btn] = true
            if (heart.mousepressed) {
                heart.mousepressed(e.pageX, e.pageY, btn)
            }
        }

        heart.canvas.onmouseup = function (e) {
            const btn = heart._mouseButtonName(e.which)
            heart.mouse._btnState[btn] = false
            if (heart.mousereleased) {
                heart.mousereleased(e.pageX, e.pageY, btn)
            }
        }

        heart.canvas.onmousemove = function (e) {
            heart.mouse._pos = { x: e.pageX - heart._canvasOffset.x, y: e.pageY - heart._canvasOffset.y }
            if (heart.mousemoved) {
                heart.mousemoved(e.pageX, e.pageY)
            }
        }

        /* keypressed and keyreleased are aliases to
			 keydown and keyup, respectively. */
        if (heart.keydown === undefined) {
            heart.keydown = heart.keypressed
        }
        if (heart.keyup === undefined) {
            heart.keyup = heart.keyreleased
        }

        heart._lastTick = window.performance.now()
        heart.timer.setTargetFPS(heart._targetFPS)

        heart._tick(heart._lastTick) /* first tick */
    }

    _tick(time: number) {
        heart._dt = time - heart._lastTick
        heart._lastTick = time
        heart._frameAccum += heart._dt

        if (heart._frameAccum >= heart._targetTickTime) {
            heart._frameAccum -= heart._targetTickTime
            heart._numFrames++
            heart._frameAccum = Math.min(heart._frameAccum, heart._targetTickTime)

            const deltaFPSTime = time - heart._lastFPSTime
            if (deltaFPSTime >= 1000) {
                heart._fps = ((heart._numFrames / deltaFPSTime) * 1000) | 0
                heart._lastFPSTime = time
                heart._numFrames = 0
            }

            if (heart.update) {
                heart.update(heart._dt / 1000)
            }

            if (heart._bg) {
                heart.ctx.fillStyle = 'rgb(' + heart._bg.r + ',' + heart._bg.g + ',' + heart._bg.b + ')'
                heart.ctx.fillRect(0, 0, heart._size.w, heart._size.h)
            }

            if (heart.draw) {
                heart.draw()
            }
        }

        window.requestAnimationFrame(heart._tick)
    }

    attach(canvas: string) {
        const el = document.getElementById(canvas)
        if (!el) {
            return false
        }
        heart.canvas = el as HTMLCanvasElement
        heart.ctx = heart.canvas.getContext('2d')
        if (!heart.ctx) {
            alert("couldn't get canvas context")
        }

        return true
    }

    _mouseButtonName(n: number): MouseButton {
        switch (n) {
            case 1:
                return 'l'
            case 2:
                return 'm'
            case 3:
                return 'r'
        }

        return 'unknown'
    }

    _getKeyChar(c: number): string {
        /* supply a hacky keymap */
        switch (c) {
            /* arrow keys */
            case 38:
                return 'up'
            case 37:
                return 'left'
            case 39:
                return 'right'
            case 40:
                return 'down'
            case 27:
                return 'escape'
            case 13:
                return 'return'
        }

        return String.fromCharCode(c).toLowerCase()
    }
}

// XXX: we need a keymap, since browsers decide on being annoying and
// not having a consistent keymap. (also, this won't work with special characters.)
window.onkeydown = function (e) {
    const c = heart._getKeyChar(e.keyCode)
    heart._keysDown[c] = true
    if (heart.keydown !== undefined) {
        heart.keydown(c)
    }
}

window.onkeyup = function (e) {
    const c = heart._getKeyChar(e.keyCode)
    heart._keysDown[c] = false
    if (heart.keyup !== undefined) {
        heart.keyup(c)
    }
}

window.onfocus = function () {
    if (heart.focus) {
        heart.focus(true)
    }
}
window.onblur = function () {
    if (heart.focus) {
        heart.focus(false)
    }
}

export const heart = new Heart()
