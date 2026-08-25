
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCGBIhr6mmVii0yEJDB1eKOrt1rFQxqep8",
  authDomain: "room-6b038.firebaseapp.com",
  databaseURL: "https://room-6b038-default-rtdb.firebaseio.com",
  projectId: "room-6b038",
  storageBucket: "room-6b038.firebasestorage.app",
  messagingSenderId: "934270380618",
  appId: "1:934270380618:web:fad67df9558c1972e194b3",
  measurementId: "G-CEWNQF4736"
};

const app = initializeApp(firebaseConfig);

export const database = getDatabase(app);

// Firebase консол дээр Authentication асаагаагүй бол нэвтрэлт локал горимд шилжинэ
export const auth = getAuth(app);

console.log('🔥 Firebase холбогдлоо!');