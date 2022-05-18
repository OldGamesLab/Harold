import { heart } from './heart.js'
import { hexFromScreen } from './geometry.js'
import globalState from './globalState.js'
import { Lighting } from './lighting.js'
import { Obj } from './object.js'
import { Renderer, SCREEN_HEIGHT, SCREEN_WIDTH, TileMap } from './renderer.js'
import { tileToScreen, TILE_HEIGHT, TILE_WIDTH } from './tile.js'
import { getFileJSON } from './util.js'
import { Config } from './config.js'

export interface ShaderSources {
    fragment: string
    vertex: string
    fragmentLighting: string
}

export class WebGLRenderer extends Renderer {
    canvas: HTMLCanvasElement
    gl: WebGLRenderingContext
    offsetLocation: WebGLUniformLocation
    positionLocation: number
    texCoordLocation: number
    uScaleLocation: WebGLUniformLocation
    uNumFramesLocation: WebGLUniformLocation
    uFrameLocation: WebGLUniformLocation
    objectUVBuffer: WebGLBuffer
    texCoordBuffer: WebGLBuffer
    tileBuffer: WebGLBuffer
    tileShader: WebGLProgram

    uLightBuffer: WebGLUniformLocation
    litOffsetLocation: WebGLUniformLocation
    litScaleLocation: WebGLUniformLocation
    u_colorTable: WebGLUniformLocation // [0x8000];
    u_intensityColorTable: WebGLUniformLocation // [65536];
    u_paletteRGB: WebGLUniformLocation // vec3 [256];
    lightBufferTexture: WebGLTexture
    floorLightShader: WebGLProgram

    textures: { [key: string]: WebGLTexture } = {} // WebGL texture cache

    shaderSources: ShaderSources

    constructor(shaderSources: ShaderSources) {
        super()
        this.shaderSources = shaderSources
    }

    newTexture(key: string, img: TexImageSource, doCache = true): WebGLTexture {
        const gl = this.gl
        const texture = this.gl.createTexture()
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture)

        // Set the parameters so we can render any size image.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

        // Upload the image into the texture.
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)

        if (doCache) {
            this.textures[key] = texture
        }
        return texture
    }

    getTexture(name: string): WebGLTexture | null {
        const texture = this.textures[name]
        if (texture !== undefined) {
            return texture
        }
        return null
    }

    getTextureFromHack(name: string): WebGLTexture | null {
        // TODO: hack (ideally it should already be in textures)
        if (this.textures[name] === undefined) {
            if (globalState.images[name] !== undefined) {
                // generate a new texture
                return this.newTexture(name, globalState.images[name])
            }
            return null
        }
        return this.textures[name]
    }

    // create a texture from an array-like thing into a 3-component Float32Array using only the R component
    // TODO: find a better format to store data in textures
    textureFromArray(arr: any, size = 256): WebGLTexture {
        const buf = new Float32Array(size * size * 4)
        for (let i = 0; i < arr.length; i++) {
            buf[i * 4] = arr[i]
        }

        const gl = this.gl
        const texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.FLOAT, buf)
        return texture
    }

    // create a texture from a Uint8Array with RGB components
    textureFromColorArray(arr: Uint8Array, width: number): WebGLTexture {
        const gl = this.gl
        const texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, width, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, arr)
        return texture
    }

    init(): void {
        this.canvas = document.getElementById('cnv') as HTMLCanvasElement

        // TODO: hack
        heart.canvas = this.canvas
        heart.ctx = null
        heart._bg = null

        const gl =
            this.canvas.getContext('webgl') || (this.canvas.getContext('experimental-webgl') as WebGLRenderingContext)
        if (!gl) {
            alert('error getting WebGL context')
            return
        }
        this.gl = gl

        if (!gl.getExtension('OES_texture_float')) {
            throw 'no texture float extension'
        }

        this.gl.clearColor(0.75, 0.75, 0.75, 1.0)
        this.gl.enable(this.gl.DEPTH_TEST)
        this.gl.depthFunc(this.gl.LEQUAL)
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT)

        // enable alpha blending
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)
        this.gl.enable(this.gl.BLEND)

        // set up tile shader
        this.tileShader = this.getProgram(this.gl, 'vertex', 'fragment')
        this.gl.useProgram(this.tileShader)

        // set up uniforms/attributes
        this.positionLocation = gl.getAttribLocation(this.tileShader, 'a_position')
        this.offsetLocation = gl.getUniformLocation(this.tileShader, 'u_offset')

        const resolutionLocation = gl.getUniformLocation(this.tileShader, 'u_resolution')
        gl.uniform2f(resolutionLocation, this.canvas.width, this.canvas.height)

        this.texCoordLocation = gl.getAttribLocation(this.tileShader, 'a_texCoord')
        this.uNumFramesLocation = gl.getUniformLocation(this.tileShader, 'u_numFrames')
        this.uFrameLocation = gl.getUniformLocation(this.tileShader, 'u_frame')

        //this.uOffsetLocation = gl.getUniformLocation(this.tileShader, "u_uOffset")
        this.uScaleLocation = gl.getUniformLocation(this.tileShader, 'u_scale')

        // provide texture coordinates for the rectangle.
        this.texCoordBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer)
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0]),
            gl.STATIC_DRAW
        )
        gl.enableVertexAttribArray(this.texCoordLocation)
        gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0)

        this.objectUVBuffer = gl.createBuffer()

        //this.tileBuffer = this.rectangleBuffer(this.gl, 0, 0, 80, 36)
        this.tileBuffer = this.rectangleBuffer(this.gl, 0, 0, 1, 1)
        gl.enableVertexAttribArray(this.positionLocation)
        gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0)

        // set up floor light shader
        if (Config.engine.doFloorLighting) {
            this.floorLightShader = this.getProgram(this.gl, 'vertex', 'fragmentLighting')
            gl.useProgram(this.floorLightShader)
            this.litOffsetLocation = gl.getUniformLocation(this.floorLightShader, 'u_offset')
            this.litScaleLocation = gl.getUniformLocation(this.floorLightShader, 'u_scale')
            this.uLightBuffer = gl.getUniformLocation(this.floorLightShader, 'u_lightBuffer')
            const litResolutionLocation = gl.getUniformLocation(this.floorLightShader, 'u_resolution')
            const litPositionLocation = gl.getAttribLocation(this.floorLightShader, 'a_position')

            gl.uniform2f(litResolutionLocation, this.canvas.width, this.canvas.height)

            const litTexCoordLocation = gl.getAttribLocation(this.floorLightShader, 'a_texCoord')
            gl.enableVertexAttribArray(litTexCoordLocation)
            gl.vertexAttribPointer(litTexCoordLocation, 2, gl.FLOAT, false, 0, 0)

            gl.enableVertexAttribArray(litPositionLocation)
            gl.vertexAttribPointer(litPositionLocation, 2, gl.FLOAT, false, 0, 0)

            // upload ancillary textures

            this.u_colorTable = gl.getUniformLocation(this.floorLightShader, 'u_colorTable')
            this.u_intensityColorTable = gl.getUniformLocation(this.floorLightShader, 'u_intensityColorTable')
            this.u_paletteRGB = gl.getUniformLocation(this.floorLightShader, 'u_paletteRGB')

            // upload color tables
            // TODO: have it in a typed array anyway
            const _colorTable = getFileJSON('colorTable.json')
            gl.activeTexture(gl.TEXTURE2)
            this.textureFromArray(_colorTable)
            gl.uniform1i(this.u_colorTable, 2)

            // intensityColorTable
            const _intensityColorTable = Lighting.intensityColorTable
            const intensityColorTable = new Uint8Array(65536)
            for (let i = 0; i < 65536; i++) {
                intensityColorTable[i] = _intensityColorTable[i]
            }
            gl.activeTexture(gl.TEXTURE3)
            this.textureFromArray(intensityColorTable)
            gl.uniform1i(this.u_intensityColorTable, 3)

            // paletteRGB
            const _colorRGB = getFileJSON('color_rgb.json')
            const paletteRGB = new Uint8Array(256 * 3)
            for (let i = 0; i < 256; i++) {
                paletteRGB[i * 3 + 0] = _colorRGB[i][0]
                paletteRGB[i * 3 + 1] = _colorRGB[i][1]
                paletteRGB[i * 3 + 2] = _colorRGB[i][2]
            }
            gl.activeTexture(gl.TEXTURE4)
            this.textureFromColorArray(paletteRGB, 256)
            gl.uniform1i(this.u_paletteRGB, 4)

            // set up light buffer texture
            gl.activeTexture(gl.TEXTURE1)
            this.lightBufferTexture = gl.createTexture()
            gl.bindTexture(gl.TEXTURE_2D, this.lightBufferTexture)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
            gl.uniform1i(this.uLightBuffer, 1) // bind the light buffer texture to the shader

            gl.activeTexture(gl.TEXTURE0)
            gl.useProgram(this.tileShader)
        }
    }

    rectangleBuffer(gl: WebGLRenderingContext, x: number, y: number, width: number, height: number): WebGLBuffer {
        const buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        const x1 = x
        const x2 = x + width
        const y1 = y
        const y2 = y + height
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]),
            gl.STATIC_DRAW
        )
        return buffer
    }

    getShader(gl: WebGLRenderingContext, id: keyof ShaderSources): WebGLShader {
        const source = this.shaderSources[id]
        const shader = gl.createShader(id.includes('fragment') ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER)
        gl.shaderSource(shader, source)
        gl.compileShader(shader)

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.log('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader))
            return null
        }

        return shader
    }

    getProgram(gl: WebGLRenderingContext, vid: keyof ShaderSources, fid: keyof ShaderSources): WebGLProgram {
        const fsh = this.getShader(gl, fid)
        const vsh = this.getShader(gl, vid)
        const program = gl.createProgram()
        gl.attachShader(program, vsh)
        gl.attachShader(program, fsh)
        gl.linkProgram(program)

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.log('Unable to initialize the shader program.')
            return null
        }

        return program
    }

    clear(): void {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT)
    }

    renderLitFloor(tileMap: string[][], useColorTable = true) {
        // initialize color tables if necessary (TODO: hack, should be initialized elsewhere)
        if (useColorTable) {
            if (Lighting.colorLUT === null) {
                Lighting.colorLUT = getFileJSON('color_lut.json')
                Lighting.colorRGB = getFileJSON('color_rgb.json')
            }
        }

        const gl = this.gl

        // use floor light shader
        gl.useProgram(this.floorLightShader)

        // bind buffers
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tileBuffer)
        gl.uniform2f(this.litScaleLocation, 80, 36)

        // bind light buffer texture in texture unit 0
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, this.lightBufferTexture)

        // allocate texture for tile image
        //gl.activeTexture(gl.TEXTURE1)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, 80, 36, 0, gl.ALPHA, gl.FLOAT, null)

        // use tile texture unit
        //gl.activeTexture(gl.TEXTURE0)

        // construct light buffer
        const lightBuffer = new Float32Array(80 * 36)
        let lastTexture = null

        // reverse i to draw in the order Fallout 2 normally does
        // otherwise there will be artifacts in the light rendering
        // due to tile sizes being different and not overlapping properly
        for (let i = tileMap.length - 1; i >= 0; i--) {
            for (let j = 0; j < tileMap[0].length; j++) {
                const tile = tileMap[j][i]
                if (tile === 'grid000') {
                    continue
                }
                const img = 'art/tiles/' + tile

                const scr = tileToScreen(i, j)
                if (
                    scr.x + TILE_WIDTH < globalState.cameraPosition.x ||
                    scr.y + TILE_HEIGHT < globalState.cameraPosition.y ||
                    scr.x >= globalState.cameraPosition.x + SCREEN_WIDTH ||
                    scr.y >= globalState.cameraPosition.y + SCREEN_HEIGHT
                ) {
                    continue
                }

                if (img !== lastTexture) {
                    gl.activeTexture(gl.TEXTURE0)

                    // TODO: uses hack
                    const texture = this.getTextureFromHack(img)
                    if (!texture) {
                        console.log('skipping tile without a texture: ' + img)
                        continue
                    }

                    gl.bindTexture(gl.TEXTURE_2D, texture)

                    lastTexture = img
                }

                // compute lighting

                // TODO: how correct is this?
                const hex = hexFromScreen(scr.x - 13, scr.y + 13)

                const isTriangleLit = Lighting.initTile(hex)
                let framebuffer
                let intensity_

                if (isTriangleLit) {
                    framebuffer = Lighting.computeFrame()
                }

                // render tile
                for (let y = 0; y < 36; y++) {
                    for (let x = 0; x < 80; x++) {
                        if (isTriangleLit) {
                            intensity_ = framebuffer[160 + 80 * y + x]
                        } else {
                            // uniformly lit
                            intensity_ = Lighting.vertices[3]
                        }

                        // blit to the light buffer
                        lightBuffer[y * 80 + x] = intensity_ //(x%2 && y%2) ? 0.5 : 0.25 //Math.max(0.25, intensity_/65536)
                    }
                }

                // update light buffer texture
                gl.activeTexture(gl.TEXTURE1)
                //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 80, 36, 0, gl.RGBA, gl.UNSIGNED_BYTE, lightBuffer)
                gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 80, 36, gl.ALPHA, gl.FLOAT, lightBuffer)

                // draw
                gl.uniform2f(
                    this.litOffsetLocation,
                    scr.x - globalState.cameraPosition.x,
                    scr.y - globalState.cameraPosition.y
                )
                gl.drawArrays(gl.TRIANGLES, 0, 6)
            }
        }

        gl.activeTexture(gl.TEXTURE0)

        // use normal shader
        gl.useProgram(this.tileShader)
    }

    drawTileMap(tilemap: TileMap, offsetY: number): void {
        const gl = this.gl
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tileBuffer)
        gl.uniform1f(this.uNumFramesLocation, 1)
        gl.uniform1f(this.uFrameLocation, 0)
        gl.uniform2f(this.uScaleLocation, 80, 36)

        for (let i = 0; i < tilemap.length; i++) {
            for (let j = 0; j < tilemap[0].length; j++) {
                const tile = tilemap[j][i]
                if (tile === 'grid000') {
                    continue
                }
                const img = 'art/tiles/' + tile

                const scr = tileToScreen(i, j)
                scr.y += offsetY
                if (
                    scr.x + TILE_WIDTH < globalState.cameraPosition.x ||
                    scr.y + TILE_HEIGHT < globalState.cameraPosition.y ||
                    scr.x >= globalState.cameraPosition.x + SCREEN_WIDTH ||
                    scr.y >= globalState.cameraPosition.y + SCREEN_HEIGHT
                ) {
                    continue
                }

                // TODO: uses hack
                const texture = this.getTextureFromHack(img)
                if (!texture) {
                    console.log('skipping tile without a texture: ' + img)
                    continue
                }
                gl.bindTexture(gl.TEXTURE_2D, texture)

                // draw
                gl.uniform2f(
                    this.offsetLocation,
                    scr.x - globalState.cameraPosition.x,
                    scr.y - globalState.cameraPosition.y
                )
                gl.drawArrays(gl.TRIANGLES, 0, 6)
            }
        }
    }

    renderRoof(roof: TileMap): void {
        this.drawTileMap(roof, -96)
    }

    renderFloor(floor: TileMap): void {
        if (Config.engine.doFloorLighting) {
            this.renderLitFloor(floor)
        } else {
            this.drawTileMap(floor, 0)
        }
    }

    renderObject(obj: Obj): void {
        const renderInfo = this.objectRenderInfo(obj)
        if (!renderInfo || !renderInfo.visible) {
            return
        }
        this.renderFrame(
            obj.art,
            renderInfo.x - globalState.cameraPosition.x,
            renderInfo.y - globalState.cameraPosition.y,
            renderInfo.uniformFrameWidth,
            renderInfo.uniformFrameHeight,
            renderInfo.artInfo.totalFrames,
            renderInfo.spriteFrameNum
        )
    }

    renderObjectOutlined(obj: Obj): void {
        this.renderObject(obj)
    }

    renderFrame(
        imgPath: string,
        x: number,
        y: number,
        width: number,
        height: number,
        totalFrames: number,
        frame: number
    ): void {
        // TODO: uses hack
        const texture = this.getTextureFromHack(imgPath)
        if (!texture) {
            console.log('no texture for object')
            return
        }

        const gl = this.gl

        // draw
        gl.bindTexture(gl.TEXTURE_2D, texture)

        gl.uniform1f(this.uNumFramesLocation, totalFrames)
        gl.uniform1f(this.uFrameLocation, frame)

        gl.uniform2f(this.offsetLocation, x, y)
        gl.uniform2f(this.uScaleLocation, width, height)

        gl.drawArrays(gl.TRIANGLES, 0, 6)
    }

    renderImage(imgPath: string, x: number, y: number, width: number, height: number): void {
        this.renderFrame(imgPath, x, y, width, height, 1, 0)
    }
}
