/*
Copyright 2014 darkf, Stratege
Copyright 2015 darkf

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

import globalState from './globalState.js'
import { Critter, WeaponObj } from './object.js'
import { Scripting } from './scripting.js'

const weaponSkins: { [weapon: string]: string } = {
    uzi: 'i',
    rifle: 'j',
}

const weaponAnims: { [weapon: string]: { [anim: string]: string } } = {
    punch: { idle: 'aa', attack: 'aq' },
}

// TODO: (Double-sided) enum
const attackMode: { [mode: string]: string | number } = {
    none: 0,
    punch: 1,
    kick: 2,
    swing: 3,
    thrust: 4,
    throw: 5,
    'fire single': 6,
    'fire burst': 7,
    flame: 8,

    0: 'none',
    1: 'punch',
    2: 'kick',
    3: 'swing',
    4: 'thrust',
    5: 'throw',
    6: 'fire single',
    7: 'fire burst',
    8: 'flame',
}

// TODO: (Double-sided) enum
const damageType: { [type: string]: string | number } = {
    Normal: 0,
    Laser: 1,
    Fire: 2,
    Plasma: 3,
    Electrical: 4,
    EMP: 5,
    Explosive: 6,

    0: 'Normal',
    1: 'Laser',
    2: 'Fire',
    3: 'Plasma',
    4: 'Electrical',
    5: 'EMP',
    6: 'Explosive',
}

// TODO: Figure out if we can derive the correct info from the game somehow
const weaponSkillMap: { [weapon: string]: string } = {
    uzi: 'Small Guns',
    rifle: 'Small Guns',
    spear: 'Melee Weapons',
    knife: 'Melee Weapons',
    club: 'Melee Weapons',
    sledge: 'Melee Weapons',
    flamethr: 'Big Guns',
    pistol: 'Small Guns',
}

interface AttackInfo {
    mode: number
    APCost: number
    maxRange: number
}

function parseAttack(weapon: WeaponObj): { first: AttackInfo; second: AttackInfo } {
    var attackModes = weapon.pro.extra['attackMode']
    var modeOne = attackMode[attackModes & 0xf] as number
    var modeTwo = attackMode[(attackModes >> 4) & 0xf] as number
    var attackOne: AttackInfo = { mode: modeOne, APCost: 0, maxRange: 0 }
    var attackTwo: AttackInfo = { mode: modeTwo, APCost: 0, maxRange: 0 }

    if (modeOne !== attackMode.none) {
        attackOne.APCost = weapon.pro.extra.APCost1
        attackOne.maxRange = weapon.pro.extra.maxRange1
    }

    if (modeTwo !== attackMode.none) {
        attackTwo.APCost = weapon.pro.extra.APCost2
        attackTwo.maxRange = weapon.pro.extra.maxRange2
    }

    return { first: attackOne, second: attackTwo }
}

// TODO: improve handling of melee
export class Weapon {
    weapon: any // TODO: any (because of melee)
    name: string
    modes: string[]
    mode: string // current mode
    type: string
    minDmg: number
    maxDmg: number
    weaponSkillType: string

    attackOne!: { mode: number; APCost: number; maxRange: number }
    attackTwo!: { mode: number; APCost: number; maxRange: number }

    constructor(weapon: WeaponObj) {
        this.weapon = weapon
        this.modes = ['single', 'called']

        if (weapon === null) {
            // default punch
            // todo: use character stats...
            // todo: fully turn this into a real weapon
            this.type = 'melee'
            this.minDmg = 1
            this.maxDmg = 2
            this.name = 'punch'
            this.weaponSkillType = 'Unarmed'
            this.weapon = {}
            this.weapon.pro = { extra: {} }
            this.weapon.pro.extra.maxRange1 = 1
            this.weapon.pro.extra.maxRange2 = 1
            this.weapon.pro.extra.APCost1 = 4
            this.weapon.pro.extra.APCost2 = 4
        } else {
            // todo: spears, etc
            this.type = 'gun'
            this.minDmg = weapon.pro.extra.minDmg
            this.maxDmg = weapon.pro.extra.maxDmg
            var s = weapon.art.split('/')
            this.name = s[s.length - 1]

            var attacks = parseAttack(weapon)
            this.attackOne = attacks.first
            this.attackTwo = attacks.second

            this.weaponSkillType = weaponSkillMap[this.name]
            if (this.weaponSkillType === undefined) console.log('unknown weapon type for ' + this.name)
        }

        this.mode = this.modes[0]
    }

    cycleMode(): void {
        this.mode = this.modes[(this.modes.indexOf(this.mode) + 1) % this.modes.length]
    }

    isCalled(): boolean {
        return this.mode === 'called'
    }

    getProjectilePID(): number {
        if (this.type === 'melee') return -1
        return this.weapon.pro.extra.projPID
    }

    // TODO: enum
    getMaximumRange(attackType: number): number {
        if (attackType === 1) return this.weapon.pro.extra.maxRange1
        if (attackType === 2) return this.weapon.pro.extra.maxRange2
        else throw 'invalid attack type ' + attackType
    }

    getAPCost(attackMode: number): number {
        return this.weapon.pro.extra['APCost' + attackMode]
    }

    getSkin(): string | null {
        if (this.weapon.pro === undefined || this.weapon.pro.extra === undefined) return null
        const animCodeMap: { [animCode: number]: string } = {
            0: 'a', // None
            1: 'd', // Knife
            2: 'e', // Club
            3: 'f', // Sledgehammer
            4: 'g', // Spear
            5: 'h', // Pistol
            6: 'i', // SMG
            7: 'j', // Rifle
            8: 'k', // Big Gun
            9: 'l', // Minigun
            10: 'm',
        } // Rocket Launcher
        return animCodeMap[this.weapon.pro.extra.animCode]
    }

    getAttackSkin(): string | null {
        if (this.weapon.pro === undefined || this.weapon.pro.extra === undefined) return null
        if (this.weapon === 'punch') return 'q'

        const modeSkinMap: { [mode: string]: string } = {
            punch: 'q',
            kick: 'r',
            swing: 'g',
            thrust: 'f',
            throw: 's',
            'fire single': 'j',
            'fire burst': 'k',
            flame: 'l',
        }

        // TODO: mode equipped
        if (this.attackOne.mode !== attackMode.none) {
            return modeSkinMap[this.attackOne.mode]
        }

        throw 'TODO'
    }

    getAnim(anim: string): string | null {
        if (weaponAnims[this.name] && weaponAnims[this.name][anim]) return weaponAnims[this.name][anim]

        var wep = this.getSkin() || 'a'
        switch (anim) {
            case 'idle':
                return wep + 'a'
            case 'walk':
                return wep + 'b'
            case 'attack':
                var attackSkin = this.getAttackSkin()
                return wep + attackSkin
            default:
                return null // let something else handle it
        }
    }

    canEquip(obj: Critter): boolean {
        return globalState.imageInfo[obj.getBase() + this.getAnim('attack')] !== undefined
    }

    getDamageType(): string {
        // Return the (string) damage type of the weapon, e.g. "Normal", "Laser", ...
        // Defaults to "Normal" if the weapon's PRO does not provide one.
        const rawDmgType = this.weapon.pro.extra.dmgType
        return rawDmgType !== undefined ? (damageType[rawDmgType] as string) : 'Normal'
    }
}

export function critterKill(
    obj: Critter,
    source?: Critter,
    useScript?: boolean,
    animName?: string,
    callback?: () => void
) {
    obj.dead = true
    obj.outline = null

    if (useScript === undefined || useScript === true) {
        Scripting.destroy(obj, source)
    }

    if (!animName || !obj.hasAnimation(animName)) animName = 'death'

    obj.staticAnimation(
        animName,
        function () {
            // todo: corpse-ify
            obj.frame-- // go to last frame
            obj.anim = undefined
            if (callback) callback()
        },
        true
    )
}

export function critterDamage(
    obj: Critter,
    damage: number,
    source: Critter,
    useScript: boolean = true,
    useAnim: boolean = true,
    damageType?: string,
    callback?: () => void
) {
    obj.stats.modifyBase('HP', -damage)
    if (obj.getStat('HP') <= 0) return critterKill(obj, source, useScript)

    if (useScript) {
        // TODO: Call damage_p_proc
    }

    // TODO: other hit animations
    if (useAnim && obj.hasAnimation('hitFront')) {
        obj.staticAnimation('hitFront', () => {
            obj.clearAnim()
            if (callback) callback()
        })
    }
}

function critterGetRawStat(obj: Critter, stat: string) {
    return obj.stats.getBase(stat)
}

function critterSetRawStat(obj: Critter, stat: string, amount: number) {
    // obj.stats[stat] = amount
    console.warn(`TODO: Change stat ${stat} to ${amount}`)
}

function critterGetRawSkill(obj: Critter, skill: string) {
    return obj.skills.getBase(skill)
}

function critterSetRawSkill(obj: Critter, skill: string, amount: number) {
    // obj.skills[skill] = amount
    console.warn(`TODO: Change skill ${skill} to ${amount}`)
}
