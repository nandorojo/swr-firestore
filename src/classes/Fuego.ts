import * as firebase from 'firebase';

type Config = Parameters<typeof firebase.initializeApp>[0];

export class Fuego {
  public db: ReturnType<firebase.app.App['firestore']>;
  constructor(config: Config) {
    this.db = !firebase.apps.length
      ? firebase.initializeApp(config).firestore()
      : firebase.app().firestore();
  }
}
