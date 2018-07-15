# Highlighter
Highlghter is a jQuery plugin for allowing users to highlight portions of a page.  You define what section can be highlighted by calling the plugin on that section $("#wrapper").highlighter();

The script expects each highlightable element to have a unique URI attribute (likely on the P or LI elements). This is used as metadata for saving the highlight.  The script tracks the start and ending words that the highlight covers.  This is per paragraph (or other wrapping element).

## Options
```
autoUpdate: false, // apparently not used
paragraphs: "p,li", // selector to identify elements that are paragraphs
highlightClass:"howdy", // class to show while highlighting
highlightClasses:"hl-color-blue hl-color-yellow hl-color-green hl-color-pink", // available highiter classes
chunkClass:"chunk", // class that is applied to each chunk/word
finishClass:"hilite",
handleStartClass:"startHandle",
handleEndClass:"endHandle",
startClass:"start",
downClass:"down",
upClass:"up",
dontSelect:"notme", // class that is put on elements that should not be allowed to be selected (sup/sub elements etc)
distance:10, // how far the user has to move the mouse to start the highlight, prevents simple clicks from starting a highlight
controls:"#controls li a",
pClass:"selecting",
colorRegex:/hl\-color\-([a-z,\d]*)/,
useLoader:true
```

## Callbacks
* setupStart
* setupEnd
* start - start drag of new highlight
* selecting - fired for each new "chunk" you mouse over
* stop - stop drag of new highlight
* handleMouseDown - 

## Methods
* loadHighlighs - Expects a JSON object as defined below
* getHighlights - Will return a list of all current highlights in the defined section in a JSON object as defined below
* turnOff - turns off availablity to highlight
* turnOn - turns it on
* isOn - ask if it is on

## JSON structure to be sent and received
```
[
	// a single element highlight
	{
		"id":"hl-id-75439723",
		"paras":[{
			"style":"hl-color-yellow",
			"uri":"para0", // unqiue ID for starting element
			"offsetStart":18, // word count of first word of highlight, 0 based or -1 for goes beyond first word (to previous element)
			"offsetEnd":29 // word count of the last word of highlight, 0 based or -1 for goes beyond last word (to next element)
		}]
	},
	// a multiple element highlight
	{
		"id": "hl-id-75439793",
		"paras": [{
			"style": "hl-color-blue",
			"uri": "para1",
			"offsetStart": -1,
			"offsetEnd": 5
		},
		{
			"style": "hl-color-blue",
			"uri": "para0",
			"offsetStart": 71,
			"offsetEnd": -1
		}]
	}
]
```
