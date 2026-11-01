// The one-command install video (YouTube: @VectisMail). Everything here is what
// the VideoObject JSON-LD and the click-to-play embed read.
const id = '__VIDEO_ID__'
const poster = '/media/install-uncut-poster.webp'

export const installVideo = {
	id,
	poster,
	title: 'Self-Hosted Email Server in One Command (Uncut Install)',
	description:
		'A complete self-hosted mail server, installed on a fresh Ubuntu 24.04 VPS with one command, in real time: TLS, the Setup Wizard, DNS, a first mailbox, and a send test from webmail.',
	uploadDate: '__UPLOAD_DATE__',
	duration: '__ISO_DURATION__',
}

export const installVideoSchema = {
	'@context': 'https://schema.org',
	'@type': 'VideoObject',
	name: installVideo.title,
	description: installVideo.description,
	thumbnailUrl: `https://vectismail.com${poster}`,
	uploadDate: installVideo.uploadDate,
	duration: installVideo.duration,
	embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
	contentUrl: `https://www.youtube.com/watch?v=${id}`,
	publisher: { '@type': 'Organization', name: 'Vectis Mail', url: 'https://vectismail.com/' },
}
