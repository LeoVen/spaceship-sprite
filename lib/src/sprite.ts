import SpriteBuilder from './builder'
import Color from './color'
import Validator from './validator'

interface SpriteParams {
    dim: [number, number]
    array?: Array<Color>
    pallet?: Array<Color>
    horizontalSymmetry?: boolean
    colorFill?: Color
}

class Sprite {
    /**
     * Sprite Dimensions
     */
    private _dim: [number, number]
    /**
     * Sprite Data
     */
    private _array: Array<Color>
    /**
     * Pallet used to generate this sprite
     */
    private _pallet: Array<Color>
    /**
     * If this sprite is horizontally simmetric
     */
    private _horizontalSymmetry: boolean

    /**
     * Do not call this constructor directly. Use the SpriteBuilder class.
     */
    constructor({
        dim,
        array,
        pallet,
        horizontalSymmetry,
        colorFill
    }: SpriteParams) {
        Validator.positiveInteger(dim[0], 'dim.x')
        Validator.positiveInteger(dim[1], 'dim.y')

        let color = colorFill === undefined ? new Color(0, 0, 0, 1) : colorFill

        let arr: Array<Color> =
            array ||
            new Array(dim[0] * dim[1]).fill(null).map(() => color.copy())

        if (dim[0] * dim[1] != arr.length) {
            throw new Error(
                `Invalid array dimensions [${dim[0]}, ${dim[1]}] for array of length ${arr.length}`
            )
        }

        this._dim = dim
        this._array = arr
        this._pallet = Sprite.trimPallet(pallet || new Array())
        this._horizontalSymmetry = horizontalSymmetry || false
    }

    public get dim(): [number, number] {
        return [...this._dim]
    }

    public get array(): Array<Color> {
        return [...this._array].map(color => color.copy())
    }

    public get pallet(): Array<Color> {
        return [...this._pallet].map(color => color.copy())
    }

    public get horizontalSymmetry(): boolean {
        return this._horizontalSymmetry
    }

    public copy(): Sprite {
        return new Sprite({
            dim: this.dim,
            array: this.array,
            pallet: this.pallet,
            horizontalSymmetry: this.horizontalSymmetry
        })
    }

    public arrayValues(): Array<[number, number, number, number]> {
        return [...this._array].map(color => color.toArray())
    }

    public matrix(): Array<Array<[number, number, number, number]>> {
        return new Array(this.dim[0])
            .fill(null)
            .map((_, i) =>
                new Array(this.dim[1])
                    .fill(null)
                    .map((_, j) => this.pixelAt(i, j).toArray())
            )
    }

    // Creates an SVG with the closest matching width and automatic height
    public svgWidth(
        width: number,
        unit: string = 'px',
        parameters: string = ''
    ): string {
        let w = width + this._dim[0] - (width % this._dim[0])
        let h = (this._dim[1] / this._dim[0]) * w
        return this.svgExact(w, h, unit, parameters)
    }

    // Creates an SVG with the closest matching height and automatic width
    public svgHeight(
        height: number,
        unit: string = 'px',
        parameters: string = ''
    ): string {
        let h = height + this._dim[1] - (height % this._dim[1])
        let w = (this._dim[0] / this._dim[1]) * h
        return this.svgExact(w, h, unit, parameters)
    }

    public svg(
        width: number,
        height: number,
        unit: string = 'px',
        parameters: string = ''
    ): string {
        let w = width + this._dim[0] - (width % this._dim[0])
        let h = height + this._dim[1] - (height % this._dim[1])
        return this.svgExact(w, h, unit, parameters)
    }

    // Creates an SVG from exact width and height
    public svgExact(
        width: number,
        height: number,
        unit: string = 'px',
        parameters: string = ''
    ): string {
        let result = `<svg ${parameters} width="${width}${unit}" height="${height}${unit}" viewBox="0, 0, ${this.dim[0]}, ${this.dim[1]}">`

        for (let x = 0; x < this._dim[0]; x++) {
            for (let y = 0; y < this.dim[1]; y++) {
                let rgba = this.pixelAt(x, y).toRgba()
                result += `<rect width="1" height="1" x="${x}" y="${y}" style="fill:${rgba};" />`
            }
        }

        return result + '</svg>'
    }

    // Creates an SVG from the sprite where each pixel is a square of pixelSize by pixelSize
    public svgScale(
        pixelSize: number,
        unit: string = 'px',
        parameters: string = ''
    ) {
        let width = this._dim[0] * pixelSize
        let height = this._dim[1] * pixelSize
        return this.svgExact(width, height, unit, parameters)
    }

    /**
     * Returns an integer array where each integer is represented by AARRGGBB
     */
    public data(): Uint32Array {
        let result = new Uint32Array(this._array.length)

        this._array.forEach((value, index) => {
            result[index] = value.toInt()
        })

        return result
    }

    /**
     * Returns a byte array with the ARGB representation
     */
    public bytes(): Uint8Array {
        let result = new Uint8Array(this._array.length * 4)

        for (let i = 0, j = 0; i < this._array.length; i += 1, j += 4) {
            let color = this._array[i]
            result[j + 0] = color.alphaByte
            result[j + 1] = color.redByte
            result[j + 2] = color.greenByte
            result[j + 3] = color.greenByte
        }

        return result
    }

    public setPixelAt(x: number, y: number, color: Color): void {
        this.checkIndex(x, y)
        this._array[y * this._dim[0] + x] = color.copy()
    }

    public pixelAt(x: number, y: number): Color {
        this.checkIndex(x, y)
        return this._array[y * this._dim[0] + x].copy()
    }

    public pixelAtChecked(x: number, y: number): Color | undefined {
        if (!this.withinBounds(x, y)) return undefined

        return this._array[y * this._dim[0] + x].copy()
    }

    public setPixelAtChecked(x: number, y: number, color: Color): boolean {
        if (!this.withinBounds(x, y)) return false

        this._array[y * this._dim[0] + x] = color.copy()
        return true
    }

    public static builder(): SpriteBuilder {
        return new SpriteBuilder({})
    }

    private static trimPallet(pallet: Array<Color>): Array<Color> {
        pallet = pallet.filter(value => value !== Color.BLACK)
        return pallet
    }

    private checkIndex(x: number, y: number): void {
        if (!this.withinBounds(x, y)) {
            throw new Error(
                `Index out of bounds [${x}, ${y}] when actual dimension is [${this.dim[0]}, ${this.dim[1]}]`
            )
        }
    }

    private withinBounds(x: number, y: number): boolean {
        return x >= 0 && x < this._dim[0] && y >= 0 && y < this._dim[1]
    }
}

export default Sprite
