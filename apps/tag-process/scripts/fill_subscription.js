const { PubSub } = require('@google-cloud/pubsub');
const { GoogleAuth } = require('google-auth-library');

const leads = [
  {
    key: '5715f26c1aa229c6282110c4fe0796ab78010ce815c339f03340ff27f8b32c7b',
    tags: ['tag_7'],
  },
];

function createBatchPromises(contacts = [], topic) {
  const publishBatch = contacts.map((contact) => {
    console.log(JSON.stringify(contact));
    const dataBuffer = Buffer.from(JSON.stringify(contact));

    const customAttributes = {
      platform: 'transactional',
      type: 'remove',
    };

    return topic.publish(dataBuffer, customAttributes);
  });

  console.log(publishBatch);
  return publishBatch;
}

async function run(batch = { contacts: [] }) {
  const maxMessages = batch.contacts.length;
  const maxWaitTime = 10;

  const auth = new GoogleAuth();
  const pubSubClient = new PubSub({ auth });

  const pubsubTopic = pubSubClient.topic('msgops-tag-process', {
    batching: {
      maxMessages: maxMessages,
      maxMilliseconds: maxWaitTime * 1000,
    },
  });

  const messages = createBatchPromises(batch.contacts, pubsubTopic);

  Promise.all(messages)
    .then((values) => {
      console.log(JSON.stringify(values));
      console.log(`Batch sended ${values.length} contacts`, values);
    })
    .catch((error) => {
      console.error(error.message || error);
    });
}

async function worker() {
  run({ contacts: leads });
}

(async () => {
  await worker();
})().catch((err) => {
  console.error(err);
});
