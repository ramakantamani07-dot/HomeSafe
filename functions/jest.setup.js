// Importing src/index.ts runs initializeApp()/getFirestore()/getMessaging() at
// module scope. Those don't make network calls just from being constructed,
// but firebase-admin still wants a project id to initialize against — this
// keeps tests hermetic without needing real credentials or the emulator.
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-homesafe-test';
