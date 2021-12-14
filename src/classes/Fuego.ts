import { FirebaseOptions, getApp, getApps, initializeApp } from "firebase/app"
import { getFirestore, FirebaseFirestore } from "firebase/firestore";
export class Fuego {
  public db: FirebaseFirestore
  constructor(config: FirebaseOptions) {
    this.db = !getApps().length ? getFirestore(initializeApp(config)) : getFirestore(getApp())
  }
}
