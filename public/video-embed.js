// Click-to-play: nothing loads from YouTube until the visitor presses play.
document.querySelectorAll('.yt-lite').forEach((btn) => {
	btn.addEventListener('click', () => {
		const frame = document.createElement('iframe');
		frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(btn.dataset.yt) + '?autoplay=1&rel=0';
		frame.title = btn.dataset.ytTitle || 'Video';
		frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
		frame.allowFullscreen = true;
		frame.className = 'yt-frame';
		btn.replaceWith(frame);
	});
});
