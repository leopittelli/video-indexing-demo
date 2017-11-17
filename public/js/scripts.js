const search = decodeURIComponent(window.location.search);
let q = "";
if (search) {
	q = search.substring(0, search.length).split("=")[1];
}

var searchMessage = document.getElementById("search-message");

if (q) {
	document.getElementById("search-input").value=q;
	searchMessage.style.display = "block";
	searchMessage.innerText = "Buscando: \"" + q + "\"";
	fetch(
		"https://us-central1-video-indexing-demo.cloudfunctions.net/searchVideo?q="+q)
		.then(response => response.json())
		.then(setupPlayer)
		.catch(e => {
			console.log(e)
		})
}

var videoPlayer = videojs('video-player');
var playButton = document.getElementById("play-button");
var pauseButton = document.getElementById("pause-button");
var nextSegmentButton = document.getElementById("next-segment-button");
var videosToShow = [];
var activeSegmentIndex = 0;
var stopTime = 0;

playButton.addEventListener("click", function() { 
	videoPlayer.play();
	playButton.disabled = true;
	pauseButton.disabled = false;
});

pauseButton.addEventListener("click", function() { 
	videoPlayer.pause();
	pauseButton.disabled = true;
	playButton.disabled = false;
});

nextSegmentButton.addEventListener("click", function() { 
	activeSegmentIndex++;
	if (activeSegmentIndex < videosToShow.length) {
		playNextSegment();
	} else {
		nextSegmentButton.disabled = true;
	}
});

videoPlayer.on('play', function() {
	playButton.disabled = true;
	pauseButton.disabled = false;
});

videoPlayer.on('pause', function() {
	pauseButton.disabled = true;
	playButton.disabled = false;
});

function setupPlayer(videos) {
	playButton.disabled = false;
	nextSegmentButton.disabled = false;
	videosToShow = [];
	activeVideoIndex = 0;
	activeSegmentIndex = 0;
	searchMessage.innerText = "Resultados para: \"" + q + "\"";

	if (videos["shotLabelAnnotations"].length === 0) {
		pauseButton.disabled = true;
		playButton.disabled = true;
		nextSegmentButton.disabled = true;

		searchMessage.innerText = "Sin resultados para: \"" + q + "\"";
		return;
	}

	videos["shotLabelAnnotations"].forEach(annotation => {
		annotation.appearances.forEach(appearance => {
			appearance.segments.forEach(segment => {
				segment.file = appearance.file;
				videosToShow.push(segment);
			})
		})
	});

	playNextSegment();
}

function playNextSegment() {
	var video = videosToShow[activeSegmentIndex];

	if (videoPlayer.currentSrc() !== video.file) {
		videoPlayer.src({type: "video/mp4", src: video.file});
		var progress = function(){ 
			videoPlayer.currentTime(video.start)
			videoPlayer.off('progress', progress);
		};
		videoPlayer.on('progress', progress);
	}

	videoPlayer.currentTime(video.start);

	stopTime = video.end;
	videoPlayer.on('timeupdate', function(e) {
		if (videoPlayer.currentTime() >= stopTime) {
			if (activeSegmentIndex+1 >=videosToShow.length) {
				nextSegmentButton.disabled = true;
			}
			videoPlayer.pause();
	    }
	});
	videoPlayer.play();
}

