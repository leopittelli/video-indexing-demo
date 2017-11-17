const cors = require('cors');

// Imports the Google Cloud client library
const Datastore = require('@google-cloud/datastore');
const Translate = require('@google-cloud/translate');

// Instantiates a client
const datastore = Datastore({
	projectId: 'video-indexing-demo'
});

const translate = new Translate();

function translateQuery(query) {
	const options = {
		to: "en"
	};

	return translate.translate(query, options)
}

/**
 * HTTP Cloud Function.
 *
 * @param {Object} req Cloud Function request context.
 * @param {Object} res Cloud Function response context.
 */
module.exports = function searchVideo(req, res) {
	corsFn = cors();
	corsFn(req, res, function() {
	   	let q = req.query.q;
		if (!q) {
			return res.json({segmentLabelAnnotations: [], shotLabelAnnotations: []});
		}

		translateQuery(q).then(results => {
			q = results[0];

			const segmentLabelKey = datastore.key(["segmentLabelAnnotations", q]);
			const shotLabelKey = datastore.key(["shotLabelAnnotations", q]);
			Promise.all([datastore.get(segmentLabelKey), datastore.get(shotLabelKey)])
				.then((results) => {
					return res.json({segmentLabelAnnotations: results[0][0] ? results[0] : [], shotLabelAnnotations: results[1][0] ? results[1] : []});
				})
		}).catch((e) => {
			console.log(e);
			return res.status(500).send();
		})
	});
};