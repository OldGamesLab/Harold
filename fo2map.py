import sys, math, struct, os, json
from construct import *
from collections import Counter

def pidType(pid):
	return (pid >> 24) & 0xff

class ScriptsIgnore(Construct):
    def _parse(self, stream, context):
        totalScriptCount = 0

        for scriptType in range(5):
        	scriptCount = SBInt32("")._parse(stream, context)
        	print "script type", scriptType, "count:", scriptCount

        	totalScriptCount += scriptCount

        	if scriptCount > 0:
        		loop = scriptCount
        		if loop % 16:
        			loop = scriptCount + (16 - scriptCount % 16)

        		checkCount = 0
        		for i in range(loop):
        			pid = SBInt32("")._parse(stream, context)
        			pid_type = pidType(pid)

        			move = 15
        			if pid_type == 1:
        				move += 2
        			elif pid_type == 2:
        				move += 1

        			if scriptType == pid_type:
        				checkCount += 1

        			Padding(move * 4)._parse(stream, context)
        			if (i % 16) == 15:
        				check = SBInt32("")._parse(stream, context)
        				SBInt32("")._parse(stream, context) # unknown

        				if checkCount < check:
        					raise Exception("script check failed")

        return totalScriptCount

    def _build(self, obj, stream, context):
        # write obj to the stream (usually not directly)
        # no return value is necessary
        raise NotImpl()

    def _sizeof(self, context):
        # return computed size, or raise SizeofError if not possible
        raise SizeofError()

class Stub(Construct):
    def _parse(self, stream, context):
        raise Exception("stub: " + self.msg)

    def _build(self, obj, stream, context):
        raise NotImpl()

    def _sizeof(self, context):
        raise SizeofError()

def stub(msg):
	s = Stub("stub")
	s.msg = msg
	return s

objtype_item = 0
objtype_critter = 1
objtype_scenery = 2
objtype_wall = 3
objtype_tile = 4
objtype_misc = 5
objtype_interface = 6
objtype_inventory = 7
objtype_head = 8
objtype_background = 9

# items
itemtype_armor = 0
itemtype_container = 1
itemtype_drug = 2
itemtype_weapon = 3
itemtype_ammo = 4
itemtype_misc = 5
itemtype_key = 6

# scenery
scenerytype_portal = 0
scenerytype_stairs = 1
scenerytype_elevator = 2
scenerytype_ladderup = 3
scenerytype_ladderdown = 4
scenerytype_generic = 5

def getProSubType(path):
	with open(os.path.join("data", path), "rb") as f:
		f.seek(0x20)
		sub = struct.unpack("!L", f.read(4))[0]
		#print "subtype:", sub
		return sub

def loadLst(lst):
	with open(os.path.join("data", lst), "r") as f:
		return [x.rstrip() for x in list(f)]

def stripExt(path):
	return os.path.splitext(path)[0]

def getProFile(lst, id):
	return lst[id]

def getCritterArtPath(frmPID):
	#"art/critters/" + stripExt(getProFile(critterLst, ctx._.frmPID & 0x00000fff))
	idx =  frmPID & 0x00000fff
	id1 = (frmPID & 0x0000f000) >> 12
	id2 = (frmPID & 0x00ff0000) >> 16
	id3 = (frmPID & 0x70000000) >> 28

	if (id2 == 0x1b or id2 == 0x1d or
			id2 == 0x1e or id2 == 0x37 or
			id2 == 0x39 or id2 == 0x3a or
			id2 == 0x21 or id2 == 0x40):
		raise Exception("reindex")
		#print "switching critter id from %d" % idx
		#idx = lst.getReIndex(idx);
		#Log("DEBUG") << "new critter id " << idx;

	path = "art/critters/" + getProFile(critterLst, idx).split(",")[0]

	#tmpBuf = ""

	if (id1 >= 0x0b):
		raise Exception("?")

	if (id2 >= 0x26 and id2 <= 0x2f):
		raise Exception("0x26 and 0x2f")
		#tmpBuf = str(id1 + 'c') + str(id2 + 0x3d)
		#tmpBuf[0] = char(id1) + 'c';
		#tmpBuf[1] = char(id2) + 0x3d;
		#path.append(tmpBuf);
		#path += tmpBuf
	elif (id2 == 0x24):
		path += "ch"
	elif (id2 == 0x25):
		path += "cj"
	elif (id2 >= 0x30):
		raise Exception("0x30")
		#tmpBuf[0] = 'r';
		#tmpBuf[1] = char(id2) + 0x31;
		#path.append(tmpBuf);
	elif (id2 >= 0x14):
		raise Exception("0x14")
		#tmpBuf[0] = 'b';
		#tmpBuf[1] = char(id2) + 0x4d;
		#path.append(tmpBuf);
	elif (id2 == 0x12):
		raise Exception("0x12")
		if id1 == 0x01:
			path += "dm"
		elif id1 == 0x04:
			path += "gm"
		else:
			path += "as"
	elif (id2 == 0x0d):
		raise Exception("0x0d")
		# if (id1 > 0) {
		# 	tmpBuf[0] = char(id1) + 'c';
		# 	tmpBuf[1] = 'e';
		# 	path.append(tmpBuf);
		# }
		# else {
		# 	path.append("an");
		# }
	else:
		#raise Exception("other")
		if (id2 <= 1 and id1 > 0):
			print "ID1:", id1
			path += chr(id1 + ord('c'))
			#tmpBuf[0] = char(id1) + 'c';
		else:
			#tmpBuf[0] = 'a';
			path += 'a'
		#tmpBuf[1] = char(id2) + 'a';
		path += chr(id2 + ord('a'))
		#path.append(tmpBuf);

	path += ".fr"
	if not id3:
		path += "m"
	else:
		path += str(id3 - 1)
		#path.append(boost::lexical_cast<std::string>(id3 - 1));

	return path

itemsLst = loadLst("proto/items/items.lst")
wallsLst = loadLst("art/walls/walls.lst")
critterLst = loadLst("art/critters/critters.lst")
miscLst = loadLst("art/misc/misc.lst")
sceneryLst = loadLst("art/scenery/scenery.lst")
sceneryProtoLst = loadLst("proto/scenery/scenery.lst")

ItemInfo = Struct("",
	Value("subtype", lambda ctx: getProSubType("proto/items/" + getProFile(itemsLst, (ctx._.protoPID & 0xffff) - 1))),
	Value("type", lambda _: "item"),
	Switch("info", lambda ctx: ctx.subtype, {
		itemtype_ammo: Struct("",
			Value("subtype", lambda _: "ammo"),
			UBInt32("ammoCount"),
			Value("artPath", lambda ctx: "art/items/" + stripExt(getProFile(wallsLst, (ctx._._.frmPID & 0xffff))))
		),
		itemtype_weapon: Struct("",
			Value("subtype", lambda _: "weapon"),
			Padding(8)
		),
		itemtype_container: Struct("", Value("subtype", lambda _: "container")),
		itemtype_armor: Struct("", Value("subtype", lambda _: "armor")),
		itemtype_drug: Struct("", Value("subtype", lambda _: "drug")),
		itemtype_misc: Struct("",
			Value("subtype", lambda _: "misc"),
			Padding(4)
		),
		itemtype_key: Struct("",
			Value("subtype", lambda _: "key"),
			Padding(4)
		)
	})
)

CritterInfo = Struct("",
	Value("type", lambda _: "critter"),
	Value("artPath", lambda ctx: stripExt(getCritterArtPath(ctx._.frmPID))),
	Padding(4*4),
	SBInt32("AInum"),
	UBInt32("groupID"),
	Padding(4),
	UBInt32("hp"),
	Padding(4*2)
)

SceneryInfo = Struct("",
	Value("type", lambda _: "scenery"),
	Value("artPath", lambda ctx: "art/scenery/" + stripExt(getProFile(sceneryLst, ctx._.frmPID & 0xffff))),
	Value("subtype", lambda ctx: getProSubType("proto/scenery/" + getProFile(sceneryProtoLst, (ctx._.protoPID & 0xffff) - 1))),
	Switch("extra", lambda ctx: ctx.subtype, {
		scenerytype_portal: Struct("",
			Value("subtype", lambda _: "portal"),
			Padding(4)
		),
		scenerytype_elevator: Struct("",
			Value("subtype", lambda _: "elevator"),
			Padding(4*2)
		),
		scenerytype_stairs: stub("stairs"),
		scenerytype_ladderup: stub("ladderup"),
		scenerytype_ladderdown: stub("ladderdown"),
		scenerytype_generic: Struct("", Value("subtype", lambda _: "generic"))
	})
)

ExtraObjectInfo = \
	Switch("extra", lambda ctx: ctx.objtype, {
		objtype_item: ItemInfo,
		objtype_wall: Struct("",
			Value("type", lambda _: "wall"),
			Value("artPath", lambda ctx: "art/walls/" + stripExt(getProFile(wallsLst, (ctx._.frmPID & 0xffff))))
		),
		objtype_critter: CritterInfo,
		objtype_misc: Struct("",
			Value("type", lambda _: "misc"),
			Value("artPath", lambda ctx: "art/misc/" + stripExt(getProFile(miscLst, ctx._.frmPID & 0xffff))),
			If(lambda ctx: (ctx._.protoPID & 0xffff) != 1 and (ctx._.protoPID & 0xffff) != 12,
				Padding(4*4))
		),
		objtype_scenery: SceneryInfo,

		# stubs
		objtype_tile: stub("tile"),
		objtype_interface: stub("interface"),
		objtype_inventory: stub("inventory"),
		objtype_head: stub("head"),
		objtype_background: stub("background")
	})

def computeLevels(ctx):
	if (ctx.elevationFlags & 8) != 0:
		if (ctx.elevationFlags & 4) != 0:
			return 1
		return 2
	return 3

object_ = Struct("object",
	Padding(4), # unknown (separator)
	SBInt32("position"),
	Padding(4*4), # unknown
	UBInt32("frameNum"), # index into FRM file
	UBInt32("orientation"),
	UBInt32("frmPID"),
	Padding(4), # unknown flags
	UBInt32("elevation"),
	UBInt32("protoPID"),
	Padding(4), # unknown
	Padding(4), # unknown (light strength?)
	Padding(4*2), # unknown
	UBInt32("mapPID"),
	SBInt32("scriptID"),
	UBInt32("numInventory"),
	Padding(4*3), # unknown

	Value("objtype", lambda ctx: (ctx.protoPID >> 24) & 0xff),
	ExtraObjectInfo,

	Array(lambda ctx: ctx.numInventory,
		Struct("inventory",
			Padding(4),
			LazyBound("", lambda: object_)
		)
	)
)

fomap = Struct("map",
	UBInt32("version"),
	String("name", 16, padchar='\0', paddir='right'),
	SBInt32("playerPos"),
	SBInt32("elevation"),
	SBInt32("playerOrientation"),
	SBInt32("numLocalVars"),
	SBInt32("scriptID"),
	SBInt32("elevationFlags"),
	Value("numLevels", computeLevels),
	SBInt32("unknown1"),
	SBInt32("numGlobalVars"),
	SBInt32("mapID"),
	SBInt32("time"),
	#Array(44, SBInt32("unknown2")),
	Padding(4*44),

	Array(lambda ctx: ctx.numGlobalVars, SBInt32("gvars")),
	Array(lambda ctx: ctx.numLocalVars, SBInt32("lvars")),

	# tiles
	# todo: elevation
	Array(10000,
		Struct("tiles",
			UBInt16("roof"),
			UBInt16("floor")
		)
	),
	#Padding(10000 * 4),

	ScriptsIgnore("scripts"),

	# map
	SBInt32("totalObjects"),
	# todo: elevation as well
	SBInt32("totalObjectsLevel"),
	Array(lambda ctx: ctx.totalObjectsLevel, object_)

	#Array(5,
	#	SBInt32("count"),
	#	
	#)
)

def main():
	if len(sys.argv) != 2:
		print "USAGE: %s MAP" % sys.argv[0]
		return

	MAP_FILE = sys.argv[1]

	with open(MAP_FILE, "rb") as f:
		data = f.read()
		map_ = fomap.parse(data)
		if map_.version != 20:
			print "not a FO2 map"
			sys.exit(1)
		#print map_
		if map_.numLevels != 1:
			raise Exception("elevation isn't 1")
		print len(map_.tiles), "tiles"
		print map_.totalObjects, "objects"
		print map_.totalObjectsLevel, "objects on level 1"

		#print map_.object[0]

		# quick export
		# break down list of 1000 tiles into a 100x100 2d list
		tiles = [tile.floor for tile in map_.tiles]
		newmap = []
		for i in range(100):
			newmap.append(tiles[i*100:i*100+100])

		lst = loadLst("art/tiles/tiles.lst")
		tileCounter = Counter()
		objectCounter = Counter()
		writeTiles = True
		writeObjects = True
		writeImageList = True

		m = {"tiles": [], "objects": []}
		if writeTiles:
			for i,row in enumerate(newmap):
				row = [stripExt(getProFile(lst, t).rstrip()) for t in row]
				for tile in row:
					tileCounter[tile] += 1
				m["tiles"].append(list(reversed(row))) # reverse because FO's maps are reversed in the X axis

		if writeObjects:
			for i,object_ in enumerate(map_.object):
				x = object_.position % 200
				y = object_.position / 200
				obj = {"type": object_.extra.type,
					   "position": {"x": x, "y": y},
					   "elevation": str(object_.elevation+1)}
				#if hasattr(object_.extra, "subtype"):
				#	obj["subtype"] = object_.extra.subtype
				if hasattr(object_.extra, "artPath"):
					obj["art"] = object_.extra.artPath
					objectCounter[object_.extra.artPath] += 1
				m["objects"].append(obj)

		json.dump(m, open(stripExt(MAP_FILE) + ".json", "w"))

		if writeImageList:
			images = list("art/tiles/" + x for x in tileCounter) + list(objectCounter)
			json.dump(images, open(stripExt(MAP_FILE) + ".images.json", "w"))
			open(stripExt(MAP_FILE)+".images.txt", "w").writelines(x+"\n" for x in images)

		for tile in tileCounter:
			print "art/tiles/" + tile
		for obj in objectCounter:
			print obj

if __name__ == '__main__':
	main()