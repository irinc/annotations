/*
 * highlighter
 * @description	Allows for creating highlights of specified content that can be sent to the server for storage
 * @version		1.0 - 2010/11/10
 * @author		Aaron Barker, Newton Saunders
 * @requires	jQuery (1.4+), ui.core.js (1.8+)
 * @optional	
 * @copyright	Intellectual Reserve, Inc.
 * @licence		Licensed under the MIT license. http://www.opensource.org/licenses/mit-license.php
 */
/*
call highlighter on an element wrapping the things you want to be highlighted

TODO: maybe use mouse.ui or build in a threshold to allow for clicking vs dragging
NOTE: Handle elements are currently appended to the body, which may cause issues when the highlight section is within a scrollable element. May need to revisit where to append and associated math if this situation arises.
*/
(function($) {
	$.widget("ui.highlighter", {
		options: {
			autoUpdate: false,
			paragraphs: "p,li", // selector to identify elements that are paragraphs
			highlightClass:"howdy",
			highlightClasses:"hl-color-blue hl-color-yellow hl-color-green hl-color-pink",
			chunkClass:"chunk",
			finishClass:"hilite",
			handleStartClass:"startHandle",
			handleEndClass:"endHandle",
			startClass:"start",
			downClass:"down",
			upClass:"up",
			dontSelect:"notme",
			distance:10,
			controls:"#controls li a",
			pClass:"selecting",
			colorRegex:/hl\-color\-([a-z,\d]*)/,
			useLoader:true // should the script prechunk down the screen onload
		},
		_create: function() {
			var opts = this.options,
				self = this,
				elem = this.element;
			opts.wordCount = 0;

			$(opts.paragraphs,elem).each(function(i){
				if(!$(this).attr("uri")){
					$(this).attr("uri","para"+i);	
				}
				$(this).data("paraNum",i);
			});
			$(opts.controls).bind("click."+self.widgetName,function(){
				// console.debug($(this),$(this).attr("class"));
				opts.finishClass = "hl-color-"+($(this).attr("class").match(opts.colorRegex)[1]);
				if(!elem.data("setup")){
					elem.data("setup",true);
					self.setup();
				}
				return false;
			});	
		},
		setup:function(){
			var opts = this.options,
				self = this,
				elem = this.element,
				todo,loader,time;

			if(!elem.data("setup")){
				elem.data("setup",true);
			}
			self._trigger("setupStart", 0, self);

			if(opts.useLoader && !opts.loaderRunning){
				time = $.browser.msie?500:100;
				loader = setInterval(function(){
					if(!opts.loaderPause){ // only do this if we aren't paused due to a highlight being created
						opts.loaderRunning = true;
						todo = $(opts.paragraphs,elem).not(".chunked");
						if(todo.length){
							self.wrapWords(todo.first());
						} else {
							// none left so kill the loader
							clearInterval(loader);
							opts.allLoaded = true;
						}
					}
				},time); // TODO: this timing probably needs to be slower for IE, just not fast enough to keep up
			}

			$(opts.paragraphs,elem).live("mouseover",function(){
				if(!$(this).data("chunked")){
					var curP = $(this);
					self.wrapWords(this,true);
					// delay the wrapping of the siblings just a touch so user can highlight sooner
					setTimeout(function(){
						// chunk previous and next paragraphs IF they should chunked (as defined in opts.paragraphs)
						self.wrapWords(curP.prev(opts.paragraphs));
						self.wrapWords(curP.next(opts.paragraphs));
					},10);
				}

				this.onselectstart=function(){return false;};
			});



			// when we click on an element add the mouseover stuff
			$("."+opts.chunkClass,elem).live("mousedown",function(event){
				self._mouseDown(event,$(this),$(this));
			});

			$("body").bind("mouseup."+self.widgetName,function(event){
				// console.debug("mouseup");
				if(opts.highlightStarted){
					opts.highlightStarted = false;
					$("."+opts.chunkClass,elem)
						.die("mouseover")
						.removeClass(opts.upClass+" "+opts.downClass+" "+opts.startClass);
					opts.startChunk = "";

					var newId = self.createHighlight(); // save off the ID created by the script

					$("."+opts.highlightClass)
						.removeClass(opts.highlightClasses);
					$("."+opts.highlightClass).addClass(opts.finishClass).removeClass(opts.highlightClass).data("hlStyle",opts.finishClass);
					// self._trigger("selected", event, self);
					opts.loaderPause = false;

					// $("body").unbind("mouseup."+self.widgetName);
					self._trigger("stop", event, newId);
				}
				$(elem).unbind("mousemove."+self.widgetName);
			});



			self._trigger("setupEnd", 0, self);
			// console.debug(opts.wordCount);
		},
		turnOff:function() {
			this.options.disabled = true;
		},
		turnOn:function() {
			this.options.disabled = false;
		},
		isOn:function() {
			return !this.options.disabled;
		},
		_mouseDown:function(event,start,last,handle){
			var opts = this.options,
				self = this,
				elem = this.element;

			if (!opts.disabled) {

			// event has already been attached, this is just the stuff that fires inside it
			// console.debug("clicked",this,event);
				if(event.which === 1 || !event.which){ // only do it for the primary mouse button
					// console.debug(1);
					self._trigger("start", event, self);

					opts.pageX = event.pageX;
					opts.pageY = event.pageY;

					opts.loaderPause = true;// stop the loader so it doesn't slow things down

					// track some stuff
					opts.startChunk = start;
					opts.lastChunk = last;
					opts.curParaNum = opts.startChunk.parents(opts.paragraphs).attr("id").replace("para","");
					opts.lastParaNum = opts.curParaNum;

					event.preventDefault(); // prevents the browser text highlight from occuring

					// now that they have clicked bind a mousemove so we can see if they move far enough to make it a highlight. this allows clciking of links if needed
					$(elem).bind("mousemove."+self.widgetName,function(event){
						// console.debug("mousemove");
						if(Math.max(Math.abs(opts.pageX - event.pageX),Math.abs(opts.pageY - event.pageY)) >= opts.distance){
							// console.debug("moved enough!");
							if(!opts.highlightStarted){ // do this once per highlight
								opts.highlightStarted = true;
								// do some stuff
								self.addItem(event,opts.startChunk);
								opts.startChunk.addClass(opts.startClass);
								opts.startChunk.parents(opts.paragraphs).addClass(opts.pClass);


								// add some event stuff
								$("."+opts.chunkClass,elem).live("mouseover",function(){
									$(this).parents(opts.paragraphs).addClass(opts.pClass);
									self.addItem(event,$(this));
									self.selecting(event,this);
								});
								event.preventDefault(); // prevents the browser text highlight from occuring

							}
							if(handle){
								if (window.getSelection) {window.getSelection().removeAllRanges();}
								else if (document.selection) {document.selection.empty();}
								// move the handle with us
								// console.debug(opts.lastChunk.attr("class"));
								handle.css({
									top:opts.lastChunk.offset().top,
									left:event.pageX+(opts.lastChunk.hasClass(opts.downClass)?5:-15)//-($(rightHandle).width()/2)
								});
							}
						}
					});
				}
			}
		},


		selecting:function(event,item){
			// console.debug("selecting");
			var opts = this.options,
				self = this,
				elem = this.element,
				subset,side,heading,start,end;
			opts.curChunk = $(item);

			self.addItem(event,opts.curChunk);

			opts.curChunkNum = opts.curChunk.data("id");
			opts.startChunkNum = opts.startChunk.data("id");
			opts.lastChunkNum = opts.lastChunk.data("id");
			// console.debug("chunkNums = start,cur,last = ",opts.startChunkNum,opts.curChunkNum,opts.lastChunkNum);

			if(opts.startChunkNum < opts.curChunkNum){
				// still after the starting point
				side = "down";
				if(opts.lastSide != "down"){
					// remove everything in front of the start... just in case
					subset = $("."+opts.upClass,elem);
					// console.debug("kill upside",subset);
					if(subset.length){
						self.removeItem(event,subset);
						subset.removeClass(opts.upClass);
					}
				}
			} else {
				// after the starting point
				side = "up";
				if(opts.lastSide != "up"){
					// remove everything after the start... just in case
					subset = $("."+opts.downClass,elem);
					// console.debug("kill downside",subset);
					if(subset.length){
						self.removeItem(event,subset);
						subset.removeClass(opts.downClass);
					}
				}
			}
			// console.debug("side,lastSide",side,opts.lastSide);
			if((opts.curChunkNum > opts.lastChunkNum && side == "down") || (opts.curChunkNum > opts.lastChunkNum && side == "up") ){
				heading = "down";
			} else if((opts.curChunkNum < opts.lastChunkNum && side == "down") || (opts.curChunkNum < opts.lastChunkNum && side == "up")){
				heading = "up";
			} else {
				heading = "not sure";
				// this fires when hovering over an element that isn't part of the highlighting system. not sure how it gets included in our set anyway, but nothing bad seems to happen when they are
				// console.debug("not sure... shouldn't have this. but doesn't seem to break anything either, so may be able to delete");
				// console.debug("chunkNums = start,cur,last = ",opts.startChunkNum,opts.curChunkNum,opts.lastChunkNum);
			}

			if(side == "down" && heading == "down"){
				// selecting more
				start = opts.lastChunk;
				if(opts.lastChunkNum < opts.startChunkNum){
					start = opts.startChunk;
				}
				subset = self.getChunks(start,opts.curChunk,"",0,0);
				subset.add(opts.curChunk).not(opts.startChunk).addClass(opts.downClass);
				self.addItem(event,subset);

			}
			if(side == "down" && heading == "up"){
				// deslecting some
				subset = self.getChunks(opts.curChunk,opts.lastChunk,opts.downClass,0,1);
				subset = subset.not(opts.curChunk);
				subset = subset.add(opts.lastChunk);
				subset.removeClass(opts.downClass);
				self.removeItem(event,subset);
			}
			if(side == "up" && heading =="up"){
				// selecting more
				end = opts.lastChunk;
				if(opts.lastChunkNum > opts.startChunkNum){
					end = opts.startChunk;
				}
				subset = self.getChunks(opts.curChunk,end,"",0,0);
				subset.add(opts.curChunk).not(opts.startChunk).addClass(opts.upClass);
				self.addItem(event,subset);
			}
			if(side == "up" && heading =="down"){
				// deselecting some
				// console.debug("up/down");
				// subset = allChunks.slice(opts.lastChunkNum,opts.curChunkNum);
				subset = self.getChunks(opts.lastChunk,opts.curChunk,opts.upClass,0,0);
				subset = subset.add(opts.lastChunk);
				subset.removeClass(opts.upClass);
				self.removeItem(event,subset);
			}


			opts.lastChunk = opts.curChunk;
			opts.lastSide = side;
			opts.lastHeading = heading;
			self._trigger("selecting", event, self);
		},
		addItem:function(event,items){
			var opts = this.options,self=this;

			$(items).each(function(){
				$(this).addClass(opts.highlightClass).addClass(opts.finishClass);
				self._trigger("selected", event, this);
			});


			return items;
		},
		getChunks:function(start,end,extraFilter,startOffset,endOffset){
			var opts = this.options,
				elem = this.element,
				startParaNum = $(start).data("paraNum"),
				endParaNum = $(end).data("paraNum"),
				startChunkNum = $(start).data("id"),
				endChunkNum = $(end).data("id"),
				potentials,dir,matchedChunks;

			potentials = $("."+opts.pClass+" ."+opts.chunkClass,elem);

			if(extraFilter){
				// we must be removing, so we can automatically remove anything that doesn't have the extraFilter
				potentials = potentials.filter("."+extraFilter);
			}

			if(startParaNum == endParaNum){
				// all in the same paragraph, so just get chunks based on siblings
				if(startChunkNum < endChunkNum){
					// on the down side of the page so use next
					dir = "down";
				} else {
					// on the up side of the page so use prev
					dir = "up";
				}
				potentials = $("#para"+startParaNum+" ."+opts.chunkClass).slice($(start).data("wrapperChunk")+startOffset,$(end).data("wrapperChunk")+endOffset);
				return potentials;
			} else {
				// para numbers are different

				//find out which way we are going
				if(startParaNum < endParaNum){
					// moving down
					dir = "down";
				} else {
					// moving up
					dir = "up";
				}
			}
			function walkChunks(chunks,dir,level){
				// console.debug(chunks,dir,endChunkNum);
				var matches = $([]),
					curChunk,returned;
				chunks.each(function(){
					curChunk = $(this);
					// console.debug("testing",curChunk);
					if(!curChunk.hasClass(opts.dontSelect)){
						if(curChunk.hasClass(opts.chunkClass)){
							// is chunk so test it
							// console.debug("testing ",curChunk.data("id"),endChunkNum,startChunkNum);
							if(dir == "down" && curChunk.data("id") < endChunkNum && curChunk.data("id") > startChunkNum){
								matches = matches.add(curChunk);
							} else if (dir == "up" && curChunk.data("id") > endChunkNum && curChunk.data("id") < startChunkNum){
								matches = matches.add(curChunk);
							} else {
								// console.debug("not in the happy zone",curChunk);
							}
						} else {
							// not a defined chunk, so we need to step into it
							if(level != -1){
								// console.debug("diving", matches);
								returned = walkChunks(curChunk.children(),dir,level+1);
								// console.debug("returned from dive",returned);
								matches = matches.add(returned);
								// console.debug("after dive added",matches);
							}
						}
						// if level is 0, look up just to make sure we aren't in a sub-element
						if(level === 0 && !curChunk.parent().is(opts.paragraphs)){
							// console.debug("stepup",curChunk);
							returned = walkChunks(curChunk.parent(),dir,-1);
						}
					}
				});
				// console.debug(matches);
				return matches;
			}
			// console.debug(potentials);
			matchedChunks = walkChunks(potentials,dir,0);
			// console.debug(matchedChunks);
			return matchedChunks;
		},
		removeItem:function(event,items){
			var opts = this.options,self=this;

			$(items).each(function(){
				var curItem = $(this);
				curItem.removeClass(opts.highlightClass).removeClass(opts.finishClass);
				if(curItem.data("hlID")){
					curItem
						.removeClass(curItem.data("hlID"))
						.removeData("hlID")
						.removeData("hlStyle")
						.unbind("."+self.widgetName); // this is presuming we only have one style per chunk. could be an issue
				}
				self._trigger("unselected", event, this);
			});

			return items;
		},
		// this take the most recently created highlight and documents it
		createHighlight:function(){
			var opts = this.options,
				self = this,
				chunks,uniqueID;
			// find all the chunks that are highlighted
			chunks = $("."+opts.highlightClass);

			if(opts.editingID){
				uniqueID = opts.editingID;
			} else {
				uniqueID = "hl-id-"+Math.floor(Math.random()*99999999);
			}

			chunks.each(function(){
				if($(this).data("hlID")){
					$(this).removeClass($(this).data("hlID"));
				}
			});

			chunks.addClass(uniqueID).data("hlID",uniqueID);

			$(chunks).unbind("mouseenter").bind("mouseenter",function(event){
				self._mouseEnter(event, this);
			});

			$(chunks).unbind("mouseleave").bind("mouseleave",function(event){
				self._mouseLeave(event, this);
			});

			opts.editingID = ""; // clear it out after each creation

			// below used for testing, not actually needed for creating a highlight
			//newHighlight = self.generateHighlightStructure(chunks);
			// console.debug(newHighlight);
			// var myJSONText = JSON.stringify(newHighlight);
			// console.debug(myJSONText);

			return uniqueID;
		},
		_mouseEnter:function(event, chunk) {
			var self = this;
			self._trigger("highlightMouseEnter", event, chunk);
		},
		_mouseLeave:function(event, chunk) {
			var self = this;
			self._trigger("highlightMouseLeave", event, chunk);
		},
		updateHighlightID:function(oldID,newID){
			var elem = this.element;
			$("."+oldID,elem)
				.addClass(newID)
				.data("hlID",newID)
				.removeClass(oldID);
		},
		applyHighlight:function(highlight){
			var opts = this.options,
				self = this;
			$.each(highlight.paras,function(){
				var hl = this,
					hlID =  highlight.id,
					curID = hl.uri,
					//thePara = $("#"+curID),
					thePara = $(opts.paragraphs,this.element).filter("[uri='" + curID + "']"),
					paraChunks,startChunk,endChunk;
				// chunk the words so we have something to highlight
				self.wrapWords(thePara);

				paraChunks = $("."+opts.chunkClass,thePara);

				startChunk = hl.offsetStart;
				if(startChunk == -1){
					startChunk = 0;
				}

				endChunk = hl.offsetEnd;
				if(endChunk == -1){
					endChunk = paraChunks.length;
				}

				paraChunks.each(function(i){
					if(i >= startChunk && i <= endChunk){
						$(this)
							.addClass(hl.style)
							.data("hlID",hlID)
							.addClass(hlID)
							.data("hlStyle",hl.style)
							.bind("mouseenter",function(event){
								self._mouseEnter(event, this);
							})
							.bind("mouseleave",function(event){
								self._mouseLeave(event, this);
							});
					}
				});
			});
		},
		removeHighlight : function(hlID) {
			var opts = this.options;
			$("." + hlID).each(function() {
				var style = $(this).data("hlStyle");
				$(this).removeClass(hlID)
					.removeClass(style)
					.unbind("mouseenter mouseleave")
					.data("hlID",null)
					.data("hlStyle",null);
			});
		},
		setColor:function(cssClass){
			this.options.finishClass = "hl-color-"+(cssClass.match(this.options.colorRegex)[1]);
			return this.options.finishClass;
		},
		loadHighlights:function(highlights){
			var self = this;
			// get passed some highlights and apply them to the page
			// ? - should we remove any existing highlights at this point?
			$.each(highlights,function(){
				self.applyHighlight(this);
			});
		},
		getHighlights:function(){
			var self = this,
				elem = this.element,
				highlights = [],
				// get all chunks that are highlighted
				highlightedChunks = $("span[class*='hl-color']",elem),
				curHlId = "";

			highlightedChunks.each(function(){
				var hlID = $(this).data("hlID"),
					chunks,highlight;
				if(hlID != curHlId){
					// console.debug("new highlight!! ",hlID);
					curHlId = hlID;
					chunks = $("."+hlID,elem);
					highlight = self.generateHighlightStructure(chunks);
					highlights.push(highlight);
				}
			});
			return highlights;
		},
		generateHighlightStructure:function(highlightedChunks){
			var opts = this.options,
				newHighlight = {},
				style,paras;

			newHighlight.id = highlightedChunks.first().data("hlID");
			style = highlightedChunks.first().data("hlStyle");
			newHighlight.paras = [];

			paras = highlightedChunks.parents(opts.paragraphs);

			paras.each(function(){
				// walk each para and find the nodes highlighted inside
				var paraChunks = $(this).find("."+newHighlight.id),
					para = {};

				para.style = style;
				para.uri = $(this).attr("uri");
				para.offsetStart = (paraChunks.first().data("wrapperChunk") === 0) ? -1:paraChunks.first().data("wrapperChunk");
				para.offsetEnd = (paraChunks.last().data("wrapperChunk") === $(this).find("."+opts.chunkClass+":last").data("wrapperChunk")) ? -1:paraChunks.last().data("wrapperChunk");
				newHighlight.paras.push(para);
			});
			// console.debug(newHighlight);
			return newHighlight;
		},
		editHighlight:function(hlID){
			var opts = this.options,
				self = this,
				elem = this.element,
				highlight = $("."+hlID,elem),
				left = highlight.first(),
				right = highlight.last(),
				leftPos = left.offset(),
				rightPos = right.offset(),
				leftHandle = $('<div id="'+self.widgetName+'-handle-left"></div>'),
				rightHandle = $('<div id="'+self.widgetName+'-handle-right"></div>');

			opts.lastEdited = hlID;

			// console.debug(left);
			// console.debug(right);
			if (window.getSelection) {window.getSelection().removeAllRanges();}
			else if (document.selection) {document.selection.empty();}
			// add handles to first and last elements (could be the same if one word)
			// whichever handle is dragged, the opposite end becomes the "startChunk" and we should be able to use the same logic as normal highlighting for editing it

			// might be editing a default highlight so things aren't setup, so run setup just in case
			if(!elem.data("setup")){self.setup();}


			$('body').append(leftHandle).append(rightHandle);

			$(leftHandle).addClass(opts.handleStartClass);
			$(rightHandle).addClass(opts.handleEndClass)

			// setup left side
			$(leftHandle).css({
				position: 'absolute',
				top:leftPos.top-12, // may need to look into this math to make more generic
				left:leftPos.left-($(leftHandle).width()/2)
			}).bind("mousedown."+self.widgetName,function(event){
				self._trigger("handleMouseDown", event, hlID);
				highlight = $("."+hlID,elem);
				left = highlight.first();
				right = highlight.last();
				opts.editingID = hlID;
				highlight.addClass(opts.highlightClass).addClass(opts.upClass);
				if(left.attr("class")){
					opts.finishClass = "hl-color-"+(left.attr("class").match(opts.colorRegex)[1]);
				}
				self._mouseDown(event,right,left,leftHandle);
			});

			// setup right side
			$(rightHandle).css({
				position: 'absolute',
				top:rightPos.top,
				left:rightPos.left+$(right).width()-($(rightHandle).width()/2)
			}).bind("mousedown."+self.widgetName,function(event){
				self._trigger("handleMouseDown", event, hlID);
				highlight = $("."+hlID,elem);
				left = highlight.first();
				right = highlight.last();
				opts.editingID = hlID;
				highlight.addClass(opts.highlightClass).addClass(opts.downClass);
				// console.debug("clicked",this,event);
				opts.finishClass = "hl-color-"+(right.attr("class").match(opts.colorRegex)[1]);
				self._mouseDown(event,left,right,rightHandle);
			});
		},
		stopEditing:function() {
			var opts = this.options,self = this;
			$('#'+self.widgetName+'-handle-left, #'+self.widgetName+'-handle-right').remove();
			opts.lastEdited = "";
		},
		destroy: function() {
			var opts = this.options;
			$.Widget.prototype.destroy.apply(this, arguments); // call the default stuff
			$(window).unbind("resize.fillHeight");
		},
		wrapWords: function(wrapper,setIndex){
			var opts = this.options,
				self = this,
				paraNum,nodes;

			wrapper = $(wrapper);
			// chunk everything

			if(wrapper.data("chunked")){return;}
			// console.time("wrapWords");
			if (wrapper.hasClass(opts.dontSelect)) {return;}

			if(wrapper.is(opts.paragraphs)){
				opts.wrapperChunkCount = 0;
				opts.curP = wrapper;
			}
			paraNum = opts.curP.data("paraNum");

			nodes = $(wrapper).textNodes();
			// console.time("loop");
			$.each(nodes.prevObject,function(i){
				var nextNonTextNode,chunks,chunkCount,combinedChunks,addSpace;
				// console.debug(this,this.nodeType);

				if(this.nodeType == 3){ // text node
					// console.debug(nodes.prevObject[i+1]);
					if(nodes.prevObject.length > 1){
						nextNonTextNode = $(nodes.prevObject[i+1]);
						// console.debug("nextNonTextNode = ",nextNonTextNode);
					} else {
						nextNonTextNode = "";
					}
					// console.debug(this.nodeValue);
					chunks = this.nodeValue.split(" ");
					chunkCount = chunks.length;
					// console.time("subLoop");
					addSpace = "";

					if (this.nodeValue.match(/^\s*$/)) {						
						combinedChunks = $("<span class='dontHighlight'>&nbsp;</span>");
					} else {
						$.each(chunks,function(i){
							var space, nodeID,newNode;
							if(this.length){
								space = (i+1 < chunkCount)?" ":"";

								nodeID = parseInt(paraNum+zeroPad(opts.wrapperChunkCount,4),10);

								newNode = $("<span class='"+opts.chunkClass+"' id='chunk"+nodeID+"'>"+addSpace+this+space+"</span>");
								newNode.data("id",nodeID)
									// .data("index",opts.wordCount)
									.data("paraNum",paraNum)
									.data("wrapperChunk",opts.wrapperChunkCount);
								if(!combinedChunks){
									combinedChunks = $(newNode);
								} else {
									combinedChunks = combinedChunks.add($(newNode));
								}
								opts.wordCount++;
								opts.wrapperChunkCount++;
								addSpace = "";
							} else {
								if ($.browser.msie){
									addSpace = "&zwj; ";
								} else {
									addSpace = " ";
								}
							}

						});
					}
					// console.timeEnd("subLoop");
					if(nextNonTextNode.length){
						nextNonTextNode.before(combinedChunks);
					} else {
						// no other nodes, so just put inside the parent
						$(wrapper).append(combinedChunks);
					}
					$(this).remove();
				} else {
					// console.debug("full element, diving in and leaving in place",this);
					if(!$(this).hasClass(opts.dontSelect)){
						// console.time("divingDeeper");
						self.wrapWords(this);
						// console.timeEnd("divingDeeper");
					}
				}
			});
			// console.timeEnd("loop");

			if(wrapper.is(opts.paragraphs)){
				wrapper.data("chunked",true);
				wrapper.addClass("chunked"); // REMOVE THIS
			}
			// console.timeEnd("wrapWords");
		}
	});

	$.extend($.ui.highlighter, {
		version: "1.0 alpha"
	});
})(jQuery);

$.fn.textNodes = function()
{
  return $(this).contents().filter(function(){ return this.nodeType == 3 ; });
};

function zeroPad(num,count){
	var numZeropad = num + '';
	while(numZeropad.length < count) {
		numZeropad = "0" + numZeropad;
	}
	return numZeropad;
}