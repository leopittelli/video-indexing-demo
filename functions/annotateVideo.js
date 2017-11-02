// Imports the Google Cloud Video Intelligence library
const videoIntelligence = require('@google-cloud/video-intelligence');
// Imports the Google Cloud client library
const Datastore = require('@google-cloud/datastore');

// Creates a client
const client = new videoIntelligence.VideoIntelligenceServiceClient();

// Instantiates a client
const datastore = Datastore({
	projectId: 'video-indexing-demo'
});


function _annotateVideo (bucket, fileName) {
	// The GCS filepath of the video to analyze
	const gcsUri = 'gs://' + bucket + '/' + fileName;

	// Construct request
	const request = {
		inputUri: gcsUri,
		features: ['LABEL_DETECTION'],
	};

	// Execute request
	return client.annotateVideo(request)
	.then(results => {
	    const operation = results[0];
	    console.log(
	      'Waiting for operation to complete... (this may take a few minutes)'
	    );
    	return operation.promise();
  })
}

function _saveLabels(kind, fileLink, labels) {
	let promises = [];
	labels.forEach(label => {
		let segments = [];
		label.segments.forEach(segment => {
			segment = segment.segment;
			if (segment.startTimeOffset.seconds === undefined) {
				segment.startTimeOffset.seconds = 0;
			}
			if (segment.startTimeOffset.nanos === undefined) {
				segment.startTimeOffset.nanos = 0;
			}
			if (segment.endTimeOffset.seconds === undefined) {
				segment.endTimeOffset.seconds = 0;
			}
			if (segment.endTimeOffset.nanos === undefined) {
				segment.endTimeOffset.nanos = 0;
			}

			segments.push({start: parseInt(segment.startTimeOffset.seconds), end: parseInt(segment.endTimeOffset.seconds)});
		});

		promises.push(_saveLabel(kind, {description: label.entity.description, appearances: [{file: fileLink, segments: segments}]}));
	});
	return Promise.all(promises)
}

function _saveLabel(kind, label) {
	const transaction = datastore.transaction();
	const labelKey = datastore.key([kind, label.description]);

  	return transaction.run()
	    .then(() => transaction.get(labelKey))
		.then((results) => {
			const l = results[0];
			if (l) {
				l.appearances.push(label.appearances[0]);
				transaction.save(l);
			} else {
				transaction.save({key: labelKey, data: label});
			}
			return transaction.commit();
	    })
	    .catch((e) => transaction.rollback());
}

/**
 * Background Cloud Function to be triggered by Cloud Storage.
 *
 * @param {object} event The Cloud Functions event.
 * @param {function} callback The callback function.
 */
module.exports = function annotateVideo(event, callback) {
	const file = event.data;

	if (file.resourceState === 'not_exists') {
		console.log(`File ${file.name} deleted.`);
		callback();	
	} else {
		_annotateVideo(file.bucket, file.name)
			.then(results => {
				const annotations = results[0].annotationResults[0];
				Promise
					.all([
						_saveLabels("segmentLabelAnnotations", file.mediaLink, annotations.segmentLabelAnnotations),
						_saveLabels("shotLabelAnnotations", file.mediaLink, annotations.shotLabelAnnotations)
					])
					.then(() => callback())
			})
			.catch(err => {
				console.log(err)
				throw new Error('Error: ', err);
	    	});
	}
};