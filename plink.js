/* Author:
 Oskar Eriksson & Dinahmoe
*/

var connection;
window.onload = function() {
	var canvas, context, timer, mouseTimer, myId = "not set", userName, canvasHeight, roomName;
	var lineWidth = 2;
	var colors = ["rgba(0,192,0,1)","rgba(250,102,250,1)","rgba(140,140,140,1)","rgba(15,150,250,1)","rgba(250,175,89,1)","rgba(250,0,0,1)","rgba(23,87,100,1)","rgba(250,250,50,1)"];
	var wHeight = window.innerHeight;
	var wWidth = window.innerWidth;
	var lineHeight = (wHeight/16) - (100/16);
	var heroX = wWidth/2;
	var frameRate = 1000/60;
	var previousSentY =	wHeight/2;
	var mouseY = wHeight/2;
	var user = {};
	var bubbles = [], userIndex = [];
	var newSustainNote = false;

	//Audio related
	var audioContext, convolver, compressor, masterGainNode, effectLevelNode, timeoutId, startTime, sounds, currentPatch, fadeTimer;
	var effectDryMix = 1.0, effectWetMix = 1.0, rhythmIndex = 0, noteTime = 0.0, notecount = 0, impulseResponseList = 0;
	var instruments = ['drums', 'voice', 'bee_long', '8bit_stab', 'bziaou', 'woody', 'syntklocka_stab', 'bassdist'];
	var notes = [], activeFades = [];
	var isPlaying = false, noFadesInProgress = true;
	var secondsPerBeat = 60.0 / 90;
	var secondsPerSub = secondsPerBeat/4;

	var impulseResponseInfoList = [{
		"name":"No Effect",
		"url":"undefined",
		"dryMix":1,
		"wetMix":0
	},{
		"name":"Stereo Delay Noise",
		"url":"impulse-responses/stereodelay_noise.wav",
		"dryMix":1,
		"wetMix":1
	}];

	//************************** Functions begins *************************
	//*********************************************************************

	//util function
	function showAlert(message, okButtonVisible, callback){
		var alertWindow = document.createElement("div");
		alertWindow.id = "alert";
		alertWindow.style.top = wHeight/2-75+"px";
		alertWindow.style.left = wWidth/2-200+"px";
		var textNode = document.createTextNode(message);
		var p = document.createElement("p");
		p.className = "alertText";
		p.innerHTML = message;
		if(okButtonVisible){
			var okButton = document.createElement("div");
			okButton.className = "okButton";
			if(roomName){
				okButton.innerHTML = "<a href=\"#"+roomName+"\">OK</a>";
			} else {
				okButton.innerHTML = "<a href=\"#\">OK</a>";
			}
			okButton.onclick = callback || function(){
				document.getElementById("main").removeChild(document.getElementById("alert"));
			}
			alertWindow.appendChild(p);
			alertWindow.appendChild(okButton);
		} else{
			alertWindow.appendChild(p);
		}
		document.getElementById("main").appendChild(alertWindow);
	}

	function documentMouseMoveHandler(event) {
		mouseY = event.clientY-50;
		if(mouseY > wHeight-100){
			mouseY = wHeight-100;
		} else if(mouseY <= 1){
			mouseY = 1;
		}
		user[myId].previousY = user[myId].mouseY;
		user[myId].mouseY = mouseY;
		user[myId].previousNote = Math.floor((user[myId].previousY*-1)/lineHeight)+17;
		user[myId].currentNote = Math.floor((user[myId].mouseY*-1)/lineHeight)+17;
		if(user[myId].currentNote != user[myId].previousNote) {
			user[myId].newNote = true;
		}
	}

	function canvasMouseDownHandler(event) {
		event.preventDefault();
		connection.send("1");
		if(!user[myId].noteAddedThisBeat){
			user[myId].noteAddedThisBeat = true;
			user[myId].previousNote = user[myId].currentNote;
			user[myId].currentNote = Math.floor((mouseY*-1)/lineHeight)+17;
			if(user[myId].selectedColor === 1 || user[myId].selectedColor === 2 || user[myId].selectedColor === 4){
				user[myId].newNote = false;
				user[myId].sustainedNote = true;
			}
			registerNote(user[myId].currentNote, rhythmIndex, user[myId].selectedColor, myId);
		}
		user[myId].mouseIsDown = true;
		return false;
	}

	function canvasMouseUpHandler(event) {
		event.preventDefault();
		connection.send("3");
		user[myId].mouseIsDown = false;
		return false;
	}

	function onDocumentKeyDown( event ) {
			if(event.keyCode === 32) {
				event.preventDefault();
				if(masterGainNode.gain.value === 0) {
					fadeOut.call(masterGainNode.gain, 0.4, 0);
				} else if (masterGainNode.gain.value === 0.4000000059604645) {
					fadeOut.call(masterGainNode.gain, 0, 2000);
				}
			}
	}

	function draw() {
		if(rhythmIndex % 4 == 2) {
			context.fillStyle = 'rgba(40,40,40,0.3)';
			context.fillRect(0, 0, context.canvas.width, context.canvas.height);
		} else {
			context.fillStyle = 'rgba(30,30,30,1)';
			context.fillRect(0, 0, context.canvas.width, context.canvas.height);
		}

		//draw reference lines
		context.beginPath();
		for(var lines = 1; lines < 17; lines++) {
			context.moveTo(0,lineHeight*lines+0.5);
			context.lineTo(wWidth,lineHeight*lines+0.5);
		}
		context.lineWidth = 1;
		context.strokeStyle = "#555";
		context.stroke();
		context.closePath();


		//push bubble-x-positions forward (or backwards?)
		for(var l = bubbles.length-1; l >= 0; l--) {
			bubbles[l].xPos -= bubbles[l].xSpeed;

			//remove bubble if it's off screen
			if(bubbles[l].xPos < 0) {
				bubbles.splice(l,1);
			}
		}

		//add new bubbles for all users
		for(var i = 0; i < userIndex.length; i++){
			if(userIndex[i] == myId){
				bubbles.unshift({
					xPos:heroX,
					yPos:mouseY,
					xSpeed: 12,
					width: lineWidth*Math.floor(Math.random()*5)+2,
					color: colors[user[myId].selectedColor],
					filled: user[myId].mouseIsDown
				});
			} else {
				bubbles.unshift({
					xPos:heroX,
					yPos:user[userIndex[i]].mouseY,
					xSpeed: 12,
					width: lineWidth*Math.floor(Math.random()*5)+2,
					color: colors[user[userIndex[i]].selectedColor],
					filled: user[userIndex[i]].mouseIsDown
				});
			}
		}

		//draw the bubbles
		for(var m = 0; m < bubbles.length; m++) {
			context.beginPath();
			context.arc(bubbles[m].xPos, bubbles[m].yPos, bubbles[m].width, 0, Math.PI*2, true);
			context.closePath();

			if(bubbles[m].filled) {
				context.fillStyle = bubbles[m].color;
				context.fill();
			} else {
				context.strokeStyle = bubbles[m].color;
				context.stroke();
			}
		}

		//originCircle
		context.beginPath();
		context.arc(heroX, mouseY, 20, 0, Math.PI*2, true);
		context.closePath();
		context.strokeStyle = colors[user[myId].selectedColor];
		context.stroke();

		//print out names
		context.font = "bold 12px sans-serif";
		context.fillStyle = "#fff";
		for(var o = 0; o < userIndex.length; o++){
			context.fillText(user[userIndex[o]].name, (heroX+20), (user[userIndex[o]].mouseY+7));
		}
		timer = setTimeout(draw, frameRate);
	}

	function init() {
		canvas = document.getElementById("music");
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight - 100;
		canvasHeight = canvas.height;
		canvas.style.top = "50px";
		context = canvas.getContext("2d");
		//Header
			var header = document.createElement("h1");
			header.className = "header";
			header.innerHTML = "Plink by <a href=\"http://www.dinahmoe.com\">DinahMoe</a>";
			header.style.left = "25px";
			document.body.appendChild(header);
		//swatches
		var changeColor = function(e) {
			e.preventDefault();
			var bits = e.target.href.split("/");
			connection.send("6,"+colors.indexOf(bits[bits.length-1]));
			return false;
		};
		var pallete = document.createElement("div");
		pallete.className = "pallete";
		pallete.style.top = ((window.innerHeight/2)-120)+"px";
		var swatch;
		for(var c = 0; c < colors.length; c++) {
			swatch = document.createElement("a");
			swatch.className = "swatch";
			swatch.href = colors[c];
			swatch.style.backgroundColor = colors[c];
			swatch.onclick = changeColor;
			pallete.appendChild(swatch);
		}
		document.getElementById("main").appendChild(pallete);
		//play info
			var playInfo = document.createElement("p");
			playInfo.className = "info";
			playInfo.innerHTML = "<strong>space</strong>: mute  ||  <strong>mouse down</strong>: play notes  ||  <strong>color</strong>: pick instrument";
			playInfo.style.left = window.innerWidth/2-245+"px";
			playInfo.style.top = wHeight-35+"px";
			document.body.appendChild(playInfo);
			//project info left
			var projectInfoL = document.createElement("p");
			projectInfoL.className = "pInfoL";
			projectInfoL.innerHTML = "<p>Built with the <a href=\"http://chromium.googlecode.com/svn/trunk/samples/audio/specification/specification.html\" target=\"_blank\">Web Audio API</a> and <a href=\"http://www.nodejs.org\" target=\"_blank\">NODE.js</a>.</p>";
			projectInfoL.style.left = "25px";
			projectInfoL.style.top = wHeight-35+"px";
			document.body.appendChild(projectInfoL);
			//project info right
			var projectInfoR = document.createElement("p");
			projectInfoR.className = "pInfoR";
			//projectInfoR.innerHTML = "<p>Read more about Plink <a href=\"http://labs.dinahmoe.com/#plink\">here</a> or check out <a href=\"http://labs.dinahmoe.com/tonecraft\">ToneCraft</a>.</p>";
			projectInfoR.innerHTML = "<p>WE ARE HIRING! Click <a href='http://www.dinahmoe.com/?page_id=554'>here</a> to read more and apply.</p>";
			projectInfoR.style.left = wWidth-350+"px";
			projectInfoR.style.top = wHeight-35+"px";
			document.body.appendChild(projectInfoR);
			//share section
			var shareDiv = document.createElement("div");
			shareDiv.className = "share";
			var alone = document.createElement("p");
			alone.innerHTML = "<span class=\"see_me\">No one to play with? Tell your friends!</span>";
			var twitterWidgets = document.createElement('script');
		    twitterWidgets.type = 'text/javascript';
		    twitterWidgets.async = true;
		    twitterWidgets.src = 'http://platform.twitter.com/widgets.js';
		    document.getElementsByTagName('head')[0].appendChild(twitterWidgets);
			var twitter = document.createElement("div");
			if(roomName){
				twitter.innerHTML = "<a href=\"http://twitter.com/share?url="+encodeURI(window.location.href)+"&via=DinahmoeSTHLM&text=I\'m%20playing%20#Plink,%20a%20multiplayer%20music%20experience%20by%20DinahMoe.%20Join%20my%20private%20jam%20at%20\" target=\"_blank\" class=\"twitter-share-button\">.</a>";
			} else {
				twitter.innerHTML = "<a href=\"http://twitter.com/share?url="+encodeURI(window.location.href)+"&via=DinahmoeSTHLM&text=I\'m%20playing%20#Plink,%20a%20multiplayer%20music%20experience%20by%20DinahMoe.%20Try%20it%20youself%20at%20\" target=\"_blank\" class=\"twitter-share-button\">.</a>";
			}
			var face = document.createElement("div");
			face.id = "fb-root";
			face.onclick = function(){
				fadeOut.call(masterGainNode.gain, 0, 500);
				FB.init({
		            appId:'184305938289381', cookie:true,
		            status:true, xfbml:true
		         });

	         	FB.ui({
	         		method: 'feed',
	         		message: "I'm playing Plink, a multiplayer music experience by DinahMoe. Try it yourself!",
	         		link: "http://labs.dinahmoe.com/plink/",
	         		name: "plink",
	         		caption: "Plink is a multiplayer music toy made by @DinahmoeSTHLM"},
	         		function(){
	         			fadeOut.call(masterGainNode.gain, 0.4, 0);
	         		}
	         	);
			};
			face.innerHTML = "<a href=\"#\"><img src=\"img/face.png\" alt=\"facebook\"/></a>";
			var googleCode = document.createElement('script');
		    googleCode.type = 'text/javascript';
		    googleCode.async = true;
		    googleCode.src = 'https://apis.google.com/js/plusone.js';
		    document.getElementsByTagName('head')[0].appendChild(googleCode);
			var plusOne = document.createElement("div");
			plusOne.innerHTML = "<g:plusone count=\"false\"></g:plusone>";
			shareDiv.appendChild(alone);
			shareDiv.appendChild(twitter);
			shareDiv.appendChild(face);
			shareDiv.appendChild(plusOne);
			shareDiv.style.left = wWidth-660+"px";
			shareDiv.style.top = "15px";
			document.body.appendChild(shareDiv);


	}

	//***********************************************************************************************************
	//***********************************************************************************************************
	//***********************************************************************************************************
	//***********************************************************************************************************
	//***********************************************************************************************************
	//*************************************AUDIO BEGINS**********************************************************
	//***********************************************************************************************************
	//***********************************************************************************************************
	//***********************************************************************************************************
	//***********************************************************************************************************
	//***********************************************************************************************************

	function decreaseVolume() {
		for(var i = activeFades.length-1; i >= 0; i--) {
			activeFades[i].target.value -= activeFades[i].rate;
			if(activeFades[i].target.value - activeFades[i].endValue < 0.001 ) {
				activeFades[i].target.value = activeFades[i].endValue;
				activeFades.splice(i, 1);
			}
		}

		if(activeFades.length === 0) {
			clearInterval(fadeTimer);
			noFadesInProgress = true;
		}
	}

	function fadeOut(endValue, fadeTime) {
		//this method is invoced by the .call()
		var that = this;
		activeFades.push({
			target: that,
			rate: ((this.value - endValue)/(fadeTime/frameRate)),
			endValue: endValue
		});

		if(noFadesInProgress) {
			fadeTimer = setInterval(decreaseVolume, frameRate);
			noFadesInProgress = false;
		}
	}

	function Patch(name) {
		this.name = name;
		this.pathName = "sounds/";
		this.soundBuffer = [];
		this.instrumentCount = 112;
		this.instrumentLoadCount = 0;
		this.startedLoading = false;
		this.isLoaded = false;
		this.effectMix = 0.5;
		this.effectIndex = 2;
		this.load();
	}

	Patch.prototype.load = function(soundName) {
		if (this.startedLoading) {
			return;
		}
		this.startedLoading = true;
		var pathName = this.pathName;
		for(var i = 0; i < colors.length; i++) {
			for(var j = 1; j < 17; j++) {
				var path = pathName + instruments[i] + "_"+j+".ogg";
				this.loadSample(i*16, j, path, false);
			}
		}
	};

	Patch.prototype.loadSample = function(instrumentID, sampleID, url, mixToMono) {
		var request = new XMLHttpRequest();
		request.open("GET", url, true);
		request.responseType = "arraybuffer";
		var patch = this;
		request.onload = function() {
			var buffer = audioContext.createBuffer(request.response, mixToMono);
			patch.soundBuffer[instrumentID + sampleID] = buffer;
			patch.instrumentLoadCount++;
			if (patch.instrumentLoadCount == patch.instrumentCount) {
				patch.isLoaded = true;
				currentPatch = patch;
				setEffect();
			}
		};
		request.send();
	};

	function ImpulseResponse(url, index) {
		this.url = url;
		this.index = index;
		this.startedLoading = false;
		this.isLoaded_ = false;
		this.buffer = 0;
	}

	ImpulseResponse.prototype.isLoaded = function() {
		return this.isLoaded_;
	};

	ImpulseResponse.prototype.load = function() {
		if (this.startedLoading) {
			return;
		}
		this.startedLoading = true;
		var request = new XMLHttpRequest();
		request.open("GET", this.url, true);
		request.responseType = "arraybuffer";
		this.request = request;
		var asset = this;
		request.onload = function() {
			asset.buffer = audioContext.createBuffer(request.response, false);
			asset.isLoaded_ = true;
		};
		request.send();
	};

	function startLoadingAssets() {

		var patch = new Patch("main");
		impulseResponseList = [];
		for (var i = 0; i < impulseResponseInfoList.length; i++) {
			impulseResponseList[i] = new ImpulseResponse(impulseResponseInfoList[i].url, i);
		}
		// Start at 1 to skip "No Effect"
		for (var j = 1; j < impulseResponseInfoList.length; j++) {
			impulseResponseList[j].load();
		}
	}

	function audioInit() {
		try {
			audioContext = new webkitAudioContext();
		} catch(error) {
			showAlert("<p><strong>Oops! Your browser doesn't support Web Audio.</strong></p><br /><p>To get the full Plink experience you need to download the <a href=\"http://www.google.com/chrome/\">latest version</a> of Google Chrome.</p>", false);
			return;
		}

		var query = decodeURI(window.location.href).split('#');
		var sessionWanted = query[query.length-1];
		if(!sessionWanted.match("[A-Za-z0-9]") || sessionWanted.match("http://labs.dinahmoe.com/plink/")){
			sessionWanted = "false";
		} else {
			roomName = sessionWanted;
		}


		startLoadingAssets();
		var finalMixNode;
		if (audioContext.createDynamicsCompressor) {
			compressor = audioContext.createDynamicsCompressor();
			compressor.connect(audioContext.destination);
			finalMixNode = compressor;
		} else {
			finalMixNode = audioContext.destination;
		}
		masterGainNode = audioContext.createGainNode();
		masterGainNode.gain.value = 0.4;
		masterGainNode.connect(finalMixNode);
		effectLevelNode = audioContext.createGainNode();
		effectLevelNode.gain.value = 0.4;
		effectLevelNode.connect(masterGainNode);
		convolver = audioContext.createConvolver();
		convolver.connect(effectLevelNode);
	}

	function playNote(buffer, pan, x, y, z, sendGain, mainGain, playbackRate, noteTime, noteObj) {
		var note = audioContext.createBufferSource();
		note.buffer = buffer;
		note.playbackRate.value = playbackRate;
		var finalNode;
		//optional panning, not used ATM...
		if (pan) {
			var panner = audioContext.createPanner();
			panner.panningModel = webkitAudioPannerNode.HRTF;
			panner.setPosition(x, y, z);
			note.connect(panner);
			finalNode = panner;
		} else if (noteObj.type === "sustain" && user[noteObj.id] != null){
				var fadeGain = audioContext.createGainNode();
				fadeGain.gain.value = 1;
				note.connect(fadeGain);
				user[noteObj.id].gainNode = fadeGain;
				finalNode = user[noteObj.id].gainNode;
				//added extra safety - deluxe
				if(!user[noteObj.id].sustainedNote){
					fadeOut.call(user[noteObj.id].gainNode.gain, 0.000001, 500);
				}
		} else {
			finalNode = note;
		}
		var dryGainNode = audioContext.createGainNode();
		dryGainNode.gain.value = mainGain * effectDryMix;
		finalNode.connect(dryGainNode);
		dryGainNode.connect(masterGainNode);
		var wetGainNode = audioContext.createGainNode();
		wetGainNode.gain.value = sendGain;
		finalNode.connect(wetGainNode);
		wetGainNode.connect(convolver);
		note.noteOn(noteTime);
	}

	function advanceNote() {
		rhythmIndex++;
		noteTime += secondsPerSub;
		for(var i = 0; i < userIndex.length; i++){
			if(user[userIndex[i]]){
				user[userIndex[i]].noteAddedThisBeat = false;
			}
		}
	}

	function playNotes() {
		var currentTime = audioContext.currentTime - startTime;
		while(noteTime < currentTime + secondsPerSub) {
			for(var i = 0; i < userIndex.length; i++){
				if(user[userIndex[i]]){
					if(user[userIndex[i]].mouseIsDown) {
						//new sustained note
						if(user[userIndex[i]].sustainedNote && user[userIndex[i]].newNote && !user[userIndex[i]].noteAddedThisBeat) {
							user[userIndex[i]].noteAddedThisBeat = true;
							fadeOut.call(user[userIndex[i]].gainNode.gain, 0, 500);
							user[userIndex[i]].newNote = false;
							registerNote(user[userIndex[i]].currentNote, rhythmIndex, user[userIndex[i]].selectedColor, userIndex[i]);
							notecount++;
						}
						//regular note
						else if(!user[userIndex[i]].noteAddedThisBeat && !user[userIndex[i]].sustainedNote) {
							registerNote(user[userIndex[i]].currentNote, rhythmIndex, user[userIndex[i]].selectedColor, userIndex[i]);
							notecount++;
							user[userIndex[i]].noteAddedThisBeat = true;
						}
					} else {
						//are you a sustained note, dear? Then fade out please.
						if(user[userIndex[i]].sustainedNote) {
							if(user[userIndex[i]].gainNode){
								user[userIndex[i]].sustainedNote = false;
								fadeOut.call(user[userIndex[i]].gainNode.gain, 0.00001, 250);
							}
						}
					}
				}
			}

			var contextPlayTime = (rhythmIndex*secondsPerSub) + startTime;
			for(var j = notes.length-1; j >= 0; j--) {
				if (rhythmIndex == notes[j].beat) {
					playNote(currentPatch.soundBuffer[(notes[j].freq) + (notes[j].sound)], false, 0,0,0, 1, 1 * 1.0, 0, contextPlayTime, notes[j]);
				} else if(rhythmIndex > notes[j].beat){
					notes.splice(j, 1);
				}
			}
			if(rhythmIndex % 4 === 0) {
				playNote(currentPatch.soundBuffer[1], false, 0,0,-2, 1, 1 * 1.0, 0, contextPlayTime, {
					sound:0
				});
			}
			advanceNote();
		}
		timeoutId = setTimeout(playNotes, 0);
	}

	function handlePlay(event) {
		noteTime = 0.0;
		startTime = audioContext.currentTime;
		playNotes();
	}

	function handleStop(event) {
		clearTimeout(timeoutId);
		notes = [];
	}

	function startStop() {
		if(isPlaying) {
			isPlaying = false;
			handleStop();
		} else {
			isPlaying = true;
			handlePlay();
		}
	}

	function setEffect() {
		var index = 1;
		if (index > 0 && !impulseResponseList[index].isLoaded()) {
			setTimeout(setEffect, 2000);
			return;
		}
		currentPatch.effectIndex = index;
		effectDryMix = impulseResponseInfoList[index].dryMix;
		effectWetMix = impulseResponseInfoList[index].wetMix;
		convolver.buffer = impulseResponseList[index].buffer;
		setEffectLevel(currentPatch);
		finishUpInit();
	}

	function setEffectLevel() {
		effectLevelNode.gain.value = currentPatch.effectMix * effectWetMix;
	}

	function Note(beat, freq, sound, name, type, color, id) {
		this.beat = beat;
		this.freq = freq;
		this.sound = sound;
		this.name = name;
		this.type = type;
		this.color = color;
		this.id = id;
	}

	function registerNote(freq, beat, color, id) {
		var sound, name;
		var type = "shot";
		if(!isNaN(color)){
			color = colors[color];
		}
			switch(color) {

				case colors[0]:
					sound = 0;
					name = instruments[0]+"_"+notecount;
					break;
				case colors[1]:
					sound = 16;
					name = instruments[1]+"_"+notecount;
					type = "sustain";
					break;
				case colors[2]:
					sound = 32;
					name = instruments[2]+"_"+notecount;
					type = "sustain";
					break;
				case colors[3]:
					sound = 48;
					name = instruments[3]+"_"+notecount;
					break;
				case colors[4]:
					sound = 64;
					name = instruments[4]+"_"+notecount;
					type = "sustain";
					break;
				case colors[5]:
					sound = 80;
					name = instruments[5]+"_"+notecount;
					break;
				case colors[6]:
					sound = 96;
					name = instruments[6]+"_"+notecount;
					break;
				case colors[7]:
					sound = 112;
					name = instruments[7]+"_"+notecount;
					break;
				default:
					//alert("no idea where that came from ");
					break;
			}
		var note = new Note(beat, freq, sound, name, type, color, id);
		notes.push(note);
	}

	//This mess is the welcome and share windows. Nasty.
	function finishUpInit(){

		var query = decodeURI(window.location.href).split('#');
		var sessionWanted = query[query.length-1];
		if(!sessionWanted.match("[A-Za-z0-9]") || sessionWanted.match("http://labs.dinahmoe.com/plink/")){
			sessionWanted = "false";
		}


		var okButton = document.createElement("div");
			okButton.className = "okButtonStart";
			if(roomName){
				okButton.innerHTML = "<a href=\"#"+roomName+"\">OK</a>";
			} else {
				okButton.innerHTML = "<a href=\"#\">OK</a>";
			}
			okButton.onclick = function(){
				document.getElementById("main").removeChild(document.getElementById("start"));
				var startWindow = document.createElement("div");
				startWindow.id = "start";
				startWindow.style.top = wHeight/2-125+"px";
				startWindow.style.left = wWidth/2-200+"px";
				var p = document.createElement("p");
				p.className = "alertText";
				p.innerHTML = "<p><strong>Plink</strong> is a <em>multiplayer music experience</em>. Please enter your nickname to display to others.</p>";
				var pTwo = document.createElement("p");
				pTwo.className = "alertTextTwo";
				pTwo.innerHTML = "<p>And why don't you give your friends a shout so they can join?</p>";

				var twitterWidgets = document.createElement('script');
			    twitterWidgets.type = 'text/javascript';
			    twitterWidgets.async = true;
			    twitterWidgets.src = 'http://platform.twitter.com/widgets.js';
			    document.getElementsByTagName('head')[0].appendChild(twitterWidgets);
				var twitter = document.createElement("div");
				if(roomName){
					twitter.innerHTML = "<a href=\"http://twitter.com/share?url="+encodeURI(window.location.href)+"&via=DinahmoeSTHLM&text=I\'m%20playing%20#Plink,%20a%20multiplayer%20music%20experience%20by%20DinahMoe.%20Join%20my%20private%20jam%20at%20\" target=\"_blank\" class=\"twitter-share-button\"><img src=\"img/twitter.png\" alt=\"twitter\"/></a>";
				} else {
					twitter.innerHTML = "<a href=\"http://twitter.com/share?url="+encodeURI(window.location.href)+"&via=DinahmoeSTHLM&text=I\'m%20playing%20#Plink,%20a%20multiplayer%20music%20experience%20by%20DinahMoe.%20Join%20me%20at%20\" target=\"_blank\" class=\"twitter-share-button\"><img src=\"img/twitter.png\" alt=\"twitter\"/></a>";
				}
				var face = document.createElement("div");
				face.id = "fb-root";
				face.onclick = function(){
					FB.init({
			            appId:'184305938289381', cookie:true,
			            status:true, xfbml:true
			         });

		         	FB.ui({
		         		method: 'feed',
		         		message: "I'm playing Plink, a multiplayer music experience by DinahMoe. Come join me!",
		         		link: "http://labs.dinahmoe.com/plink/",
		         		name: "plink",
		         		caption: "plink is a multiuser online music machine made by @DinahmoeSTHLM"}
		         	);
	         	};
				face.innerHTML = "<a href=\"#\"><img src=\"img/face.png\" alt=\"facebook\"/></a>";var shareDiv = document.createElement("div");
				shareDiv.className = "shareStart";
				shareDiv.appendChild(twitter);
				shareDiv.appendChild(face);
				shareDiv.style.left = "130px";
				shareDiv.style.top = "140px";
				var nameInput = document.createElement("input");
				nameInput.value = "Sneaky Plinker";
				nameInput.id = "nameInput";
				var okButton = document.createElement("div");
				okButton.className = "okButtonStart";
				if(roomName){
					okButton.innerHTML = "<a href=\"#"+roomName+"\">OK</a>";
				} else {
					okButton.innerHTML = "<a href=\"#\">OK</a>";
				}
				okButton.onclick = function(){
					while(!nameInput.value.match(/^[a-zA-Z\s\d]+$/)){
						nameInput.value = prompt("Sorry, please use A-z and numbers only!", "Mr Plink");
					}
					userName = nameInput.value;
					document.getElementById("main").removeChild(document.getElementById("start"));
					//start socket connection
						if ( window.WebSocket ) {
							var xhr = new XMLHttpRequest();
							xhr.open("POST", "testFile.txt");
							xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
									xhr.onreadystatechange = function(){
									    if(xhr.readyState == 4){
									        if(xhr.status==200){

									 			connection = new WebSocket("ws://50.57.87.228:80/");

												connection.onopen = function(event){
													console.log("connection created");
												};

												connection.onclose = function(event){
													handleStop();
													showAlert("You've been idle for too long, or perhaps the server had to reboot! Please reload you browser if you'd like to keep playing.", false);
													console.log(event);
												};

												connection.onerror= function(event){
													console.log("connection error:");
													console.log(event);
													showAlert("Our server seems to be a little busy. Maybe we're updating? Please try a reload.", false);
												};

												connection.onmessage = function(event){
													var data = event.data.split(",");
													var uId = parseInt(data[0],10);
                                                    
                                                    /*  DEBUG SOCKET INFO:
                                                     * first variable: user id
                                                     * 2nd var: action
                                                     * action 0: your UserId
                                                     * action 1: press down
                                                     * action 2: movement(y-axis)
                                                     * action 3: release
                                                     * action 4: player joined(name,player number?)
                                                     * action 5: player left
                                                     * action 6: instrument chagned
                                                     * action 7: received current user(s)
                                                    **/ 
                                                    var str = "";
                                                    for(i in data){
                                                        str += data[i] + "|"; 
                                                    }
                                                    console.log("size:"+data.length+ " "+str);
            
													/*if(isNaN(data[0])){
														console.log(data[0]);
													}*/


													//set myId
													if(parseInt(data[1],10) === 0){
													/*	if(user[myId]){
															delete user[myId];
														}*/
														if(uId !== myId){
															myId = uId;
														}
														user[myId] = {
																		mouseY: wHeight/2,
																		previousY: 0,
																		selectedColor: 1,
																		noteAddedThisBeat: false,
																		mouseIsDown: false,
																		name: userName,
																		sustainedNote: false,
																		newNote: false,
																		gainNode: null,
																		previousNote: 8,
																		currentNote: 8
																	};
																	userIndex.push(myId);
													}

													//someone played a note
													if(parseInt(data[1],10) === 1){
														if(uId !== myId){
															user[uId].previousNote = user[uId].currentNote;
															user[uId].currentNote = Math.floor((user[uId].mouseY*-1)/lineHeight)+17;
															registerNote(user[uId].currentNote, rhythmIndex, user[uId].selectedColor, uId);
															user[uId].noteAddedThisBeat = user[uId].mouseIsDown = true;
															if(user[uId].selectedColor === 1 || user[uId].selectedColor === 2 || user[uId].selectedColor === 4){
																user[uId].sustainedNote = true;
															}
														}
													}

													//someone moved their mouse!
													if(parseInt(data[1],10) === 2){
														if(uId !== myId){
															user[uId].previousY = user[uId].mouseY;
															user[uId].mouseY = data[2]*canvasHeight;
															user[uId].previousNote = Math.floor((user[uId].previousY*-1)/lineHeight)+17;
															user[uId].currentNote = Math.floor((user[uId].mouseY*-1)/lineHeight)+17;
															if(user[uId].currentNote != user[uId].previousNote) {
																	user[uId].newNote = true;
															}
														}
													}

													//someone stopped playing a note
													if(parseInt(data[1],10) === 3){
														if(uId !== myId){
															user[uId].mouseIsDown = false;
														}
													}

													//someone joined the fun
													if(parseInt(data[1],10) === 4){
														if(uId !== myId){
															user[uId] = {
																mouseY: wHeight/2,
																previousY: 0,
																selectedColor: data[3],
																noteAddedThisBeat: false,
																mouseIsDown: false,
																name: data[2] || "Sneaky Plinker",
																sustainedNote: false,
																newNote: false,
																gainNode: null,
																previousNote: 8,
																currentNote: 8
															};
															userIndex.push(uId);
														}
													}

													//someone left :(
													if(parseInt(data[1],10) === 5){
														delete user[uId];
														userIndex.splice(userIndex.indexOf(uId), 1);
													}

													//someone changed instrument
													if(parseInt(data[1],10) === 6){
														user[uId].selectedColor = parseInt(data[2],10);
													}

													//we just recieved a current user! nice.
													if(parseInt(data[1],10) === 7){
															//add user, starting at 2 (0 and 1 are mumbojumbo)
																	user[parseInt(data[2],10)] = {
																		mouseY: wHeight/2,
																		previousY: 0,
																		selectedColor: data[3],
																		noteAddedThisBeat: false,
																		mouseIsDown: false,
																		name: data[4],
																		sustainedNote: false,
																		newNote: false,
																		gainNode: null,
																		previousNote: 8,
																		currentNote: 8
																	};
																	userIndex.push(parseInt(data[2],10));
													}

													//someone changed name
													if(parseInt(data[1],10) === 10){
														user[uId].name = data[2];
													}

													//hey, that's my starting instrument!
													if(parseInt(data[1],10) === 50){
														user[myId].selectedColor = parseInt(data[2],10);
													}

													//server wants to know about rooms and our name...
													if(parseInt(data[1],10) === 500){
														connection.send("33,"+userName+","+sessionWanted);
													}

													//rooms was full
													if(parseInt(data[1],10) === 700){
														showAlert("The room you're trying to enter has reached it's maximum number of users. You've been put in a public room instead.", true);
														sessionWanted = false;
														connection.send("33,"+userName+","+sessionWanted);
													}

													//ready to go!
													if(parseInt(data[1],10) === 100){
															canvas.addEventListener('mousedown', canvasMouseDownHandler, false);
															window.addEventListener('mouseup', canvasMouseUpHandler, false);
															canvas.addEventListener('mousemove', documentMouseMoveHandler, false);
															document.addEventListener( 'keydown', onDocumentKeyDown, false );
														//	isPlaying = true;
															startStop();
															//connection.send("10,"+userName);
															timer = setTimeout(draw, frameRate);
															mouseTimer = setInterval(function(){
																if(mouseY !== previousSentY){
																	connection.send("2,"+mouseY/(canvas.height));
																	previousSentY = mouseY;
																}
															},frameRate);
													}

												};
									        }
									    }
									};
									xhr.send();
						}
				};
				startWindow.appendChild(p);
				startWindow.appendChild(nameInput);
				startWindow.appendChild(pTwo);
				startWindow.appendChild(shareDiv);
				startWindow.appendChild(okButton);
				document.getElementById("main").appendChild(startWindow);
			};
			startWindow.removeChild(loading);
			startWindow.appendChild(okButton);
	}

	var startWindow = document.createElement("div");
		startWindow.id = "start";
		startWindow.style.top = wHeight/2-125+"px";
		startWindow.style.left = wWidth/2-200+"px";
		var p = document.createElement("p");
		p.className = "alertText";
		p.innerHTML = "<p><strong>Plink</strong> is a Chrome and <a href=\"http://chromium.googlecode.com/svn/trunk/samples/audio/specification/specification.html\">Web Audio API</a> experiment by <a href=\"http://www.dinahmoe.com\">DinahMoe</a>.</p><br/><p>If you experience performance issues, please check <a href=\"http://labs.dinahmoe.com\">labs.dinahmoe.com</a> for more information.</p>";
		var loading = document.getElementById("loading");
		startWindow.appendChild(p);
		startWindow.appendChild(loading);
		document.getElementById("main").appendChild(startWindow);
		audioInit();
		init();
};

window.onunload = function(){
	connection.close();
};