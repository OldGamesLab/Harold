/*
Copyright 2014 darkf, Stratege

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

// Geometry-related functions, for the hex and isometric grids

// geometry constants
export const HEX_GRID_SIZE = 200 // hex grid is 200x200

export const HEX_WIDTH = 32;
export const HEX_HEIGHT = 16;

export interface Point {
    x: number
    y: number
}

interface Point3 {
    x: number
    y: number
    z: number
}

export interface BoundingBox {
    x: number
    y: number
    w: number
    h: number
}

export function hexToScreen(x: number, y: number): Point {
    var sx = 4816 - ((((x + 1) >> 1) << 5) + ((x >> 1) << 4) - (y << 4))
    var sy = 12 * (x >> 1) + y * 12 + 11

    return { x: sx, y: sy }
}

export function pixel2Cube(point: Point): Point3 {
    let x = point.x / HEX_WIDTH - point.y / 3 / (HEX_HEIGHT/2);
    let z = point.y / (HEX_HEIGHT * 3 / 4);
    return { x, y: -x - z, z };
}

export function cubeRound(cube: Point3): Point3 {
    let round = {
        x: Math.round(cube.x),
        y: Math.round(cube.y),
        z: Math.round(cube.z)
    };

    let diff = {
        x: Math.abs(round.x - cube.x),
        y: Math.abs(round.y - cube.y),
        z: Math.abs(round.z - cube.z)
    };

    if (diff.x > diff.y && diff.x > diff.z)
      round.x = -round.y - round.z;
    else if (diff.y > diff.z)
      round.y = -round.x - round.z;
    else
      round.z = -round.x - round.y;

    return round;
}

export function hexFromCubeRound(cubeRound) {
    let x = (cubeRound.x - 150) * (-1);
    let y = (cubeRound.z + (cubeRound.x - (!(cubeRound.x & 1))) / 2 - 75) | 0;
  
    return { x, y };
}

export function hexFromScreen(x: number, y: number): Point {
    return hexFromCubeRound(cubeRound(pixel2Cube({x,y})));
}

export function hexNeighbors(position: Point): Point[] {
    const neighbors: Point[] = []
    var x = position.x
    var y = position.y

    function n(x: number, y: number) {
        neighbors.push({ x: x, y: y })
    }

    if (x % 2 === 0) {
        n(x - 1, y)
        n(x - 1, y + 1)
        n(x, y + 1)
        n(x + 1, y + 1)
        n(x + 1, y)
        n(x, y - 1)
    } else {
        n(x - 1, y - 1)
        n(x - 1, y)
        n(x, y + 1)
        n(x + 1, y)
        n(x + 1, y - 1)
        n(x, y - 1)
    }

    return neighbors
}

export function hexInDirection(position: Point, dir: number): Point {
    return hexNeighbors(position)[dir]
}

export function hexInDirectionDistance(position: Point, dir: number, distance: number): Point {
    if (distance === 0) {
        return position
    }

    let tile = hexInDirection(position, dir)
    // repeat for each further distance
    for (var i = 0; i < distance - 1; i++) {
        tile = hexInDirection(tile, dir)
    }
    return tile
}

export function directionOfDelta(xa: number, ya: number, xb: number, yb: number): number | null {
    let neighbors = hexNeighbors({ x: xa, y: ya })
    for (var i = 0; i < neighbors.length; i++) {
        if (neighbors[i].x === xb && neighbors[i].y === yb) return i
    }

    return null
}

function hexGridToCube(grid: Point): Point3 {
    //even-q layout -> cube layout
    var z = grid.y - (grid.x + (grid.x & 1)) / 2
    var y = -grid.x - z
    return { x: grid.x, y: y, z: z }
}

export function hexDistance(a: Point, b: Point): number {
    // we convert our hex coordinates into cube coordinates and then
    // we only have to see which of the 3 axes is the longest

    var cubeA = hexGridToCube(a)
    var cubeB = hexGridToCube(b)
    return Math.max(Math.abs(cubeA.x - cubeB.x), Math.abs(cubeA.y - cubeB.y), Math.abs(cubeA.z - cubeB.z))
}

// Direction between hexes a and b
export function hexDirectionTo(a: Point, b: Point): number {
    // TODO: check correctness
    const delta = { x: b.x - a.x, y: b.y - a.y }

    if (delta.x) {
        const angle = (Math.atan2(-delta.y, delta.x) * 180) / Math.PI
        let temp = (90 - angle) | 0
        if (temp < 0) temp += 360
        return Math.min((temp / 60) | 0, 5)
    } else if (delta.y < 0) return 0
    return 2
}

function hexOppositeDirection(direction: number) {
    return (direction + 3) % 6
}

// The adjacent hex around a nearest to b
export function hexNearestNeighbor(a: Point, b: Point) {
    var neighbors = hexNeighbors(a)
    var min = Infinity,
        minIdx = -1
    for (var i = 0; i < neighbors.length; i++) {
        var dist = hexDistance(neighbors[i], b)
        if (dist < min) {
            min = dist
            minIdx = i
        }
    }
    if (minIdx === -1) return null
    return { hex: neighbors[minIdx], distance: min, direction: minIdx }
}

// Draws a line between a and b, returning the list of coordinates (including b)
export function hexLine(a: Point, b: Point): Point[] {
    var path = []
    var position: Point = { x: a.x, y: a.y }

    while (true) {
        path.push(position)
        if (position.x === b.x && position.y === b.y) return path
        var nearest = hexNearestNeighbor(position, b)
        if (nearest === null) return null
        position = nearest.hex
    }

    // throw "unreachable"
}

export function hexesInRadius(center: Point, radius: number) {
    var hexes = []
    for (var x = 0; x < 200; x++) {
        for (var y = 0; y < 200; y++) {
            if (x === center.x && y === center.y) continue
            var pos = { x: x, y: y }
            if (hexDistance(center, pos) <= radius) hexes.push(pos)
        }
    }
    return hexes
}

export function pointInBoundingBox(point: Point, bbox: BoundingBox) {
    return bbox.x <= point.x && point.x <= bbox.x + bbox.w && bbox.y <= point.y && point.y <= bbox.y + bbox.h
}

export function tile_in_tile_rect(tile: Point, a: Point, b: Point, c: Point, d: Point) {
    //our rect looks like this:
    //a - - - - b
    //.			.
    //.			.
    //.			.
    //d - - - - c
    //or like this:
    //		a
    //    .   .
    //  .       .
    //d 		  b
    //  .       .
    //    .   .
    //		c
    //these are the only possibilities that give sensical rectangles,
    // anything else involves guessing of tiles on the borders anyway
    //if I get the topmost position and check if it's below that
    //and get the downmost position and check if it's above that
    //and get the leftmost position and check if it's to the right of that
    //and the rightmost and check if it's to the left of that
    //then I do get inside a rect
    //but not a rect where my points are necessarily corner points.

    //assumption: well behaved rectangle in a grid
    //a = min x, min y
    //b = min x, max y
    //c = max x, max y
    //d = max x, min y
    var error = false
    if (c.x != d.x || a.x != b.x || a.x > c.x) error = true
    if (a.y != d.y || b.y != c.y || a.y > c.y) error = true
    if (error) {
        console.log(
            'This is not a rectangle: (' +
                a.x +
                ',' +
                a.y +
                '), (' +
                b.x +
                ',' +
                b.y +
                '), (' +
                c.x +
                ',' +
                c.y +
                '), (' +
                d.x +
                ',' +
                d.y +
                ')'
        )
        return false
    }
    var inside = true
    if (tile.x <= a.x || tile.x >= c.x) inside = false
    if (tile.y <= a.y || tile.y >= c.y) inside = false

    return inside
}

function tile_in_tile_rect2(tile: Point, a: Point, c: Point) {
    var b = { x: a.x, y: c.y }
    var d = { x: c.x, y: a.y }
    return tile_in_tile_rect(tile, a, b, c, d)
}

export function pointIntersectsCircle(center: Point, radius: number, point: Point): boolean {
    return Math.abs(point.x - center.x) <= radius && Math.abs(point.y - center.y) <= radius
}
