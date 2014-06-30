// DarkFO
// Copyright (c) 2014 darkf
// Licensed under the terms of the zlib license

function parseIni(text) {
	// Parse a .ini-style categorized key-value format
	var lines = text.split('\n')
	var category = null
	var ini = {}

	for(var i = 0; i < lines.length; i++) {
		var line = lines[i].replace(/\s*;.*/, "") // replace comments
		if(line.trim() === '') { }
		else if(line[0] === '[')
			category = line.trim().slice(1, -1)
		else {
			// key=value
			var kv = line.match(/(.+?)=(.+)/)
			if(kv === null) { // MAPS.TXT has one of these, so it's not an exception
				console.log("warning: parseIni: not a key=value line: " + line)
				continue
			}
			if(category === null) throw "parseIni: key=value not in category: " + line

			if(ini[category] === undefined) ini[category] = {}
			ini[category][kv[1]] = kv[2]
		}
	}

	return ini
}

function getFileText(path) {
	var r = null
	$.get(path, function(text) { r = text }, "text").fail(function() {
		throw "getFileText: getting path " + path + " failed"
	})
	return r
}

function rollSkillCheck(skill, modifier, isBounded)
{
	var tempskill = skill+modifier
	if(isBounded === true)
	{
		if(tempskill < 0) tempskill = 0
		if(tempskill > 95) tempskill = 95
	}
	var roll = combat.getRandomInt(0,100)
	if(roll < skill)
	{
		return true
	}else{
		return false
	}
}