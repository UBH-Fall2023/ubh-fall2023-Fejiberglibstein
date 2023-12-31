// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
	getDatabase,
	set,
	ref,
	onDisconnect,
	remove,
	get,
	onChildRemoved,
	onValue,
} from "firebase/database";
import * as MAIN from "./three/main";
import * as SCRAMBLER from "cube-scramble.js";
import { Move } from "./three/cube";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
	apiKey: "AIzaSyAdqvYZ_FdKpojq58im_HLvOMFHA8CbbgE",
	authDomain: "hackathon-cube.firebaseapp.com",
	databaseURL: "https://hackathon-cube-default-rtdb.firebaseio.com",
	projectId: "hackathon-cube",
	storageBucket: "hackathon-cube.appspot.com",
	messagingSenderId: "734476983951",
	appId: "1:734476983951:web:ec00608a63343cc82f9afa",
	measurementId: "G-FLJZ44KWZ6",
};

// Initialize Firebase
let userID: String;
let userRef;
let code: String;
let dueledUserRef;
let dueledUserID;
let dueledUserOldMoves: Move[] = [];
let scramble;
let yourMoves: Move[] = [];

const form = document.getElementById("form") as HTMLFormElement;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

signInAnonymously(auth).catch((error) => {
	console.error(error);
});
auth.onAuthStateChanged((user) => {
	if (user) {
		userID = user.uid;
		code = user.uid.slice(0, 6);
		userRef = ref(db, `users/${userID}`);

		set(userRef, {
			id: userID,
			code: code,
		});
		onDisconnect(userRef).remove();
		init();
	}
});

// you do a turn
export function writeTurn(move: Move) {
	yourMoves.push(move)
	set(ref(db, `/users/${userID}/moves`), yourMoves);
}

async function init() {
	// Update racing in case the dueled user leaves
	onChildRemoved(ref(db, "/users/"), (snapshot) => {
		if (snapshot.val().racing == userID) {
			remove(ref(db, `/users/${userID}/racing`));
			remove(ref(db, `/users/${userID}/scramble`));
			remove(ref(db, `/users/${userID}/moves`));
			dueledUserID = null;
			dueledUserRef = null;
      dueledUserOldMoves = [];
      yourMoves = [];
			scramble = null;
			(document.getElementById("opponent-cube") as HTMLSpanElement).style.display =
				"none";
		}
	});

	// Hide form if you are dueling someone
	onValue(ref(db, `/users/${userID}/racing`), (snapshot) => {
		form.querySelectorAll("input").forEach((el) => {
			el.hidden = snapshot.val();
		});
		(document.getElementById("opponent-cube") as HTMLSpanElement).style.display =
			snapshot.val() ? "block" : "hidden";

		dueledUserID = snapshot.val();

		// opponent does a turn
		onValue(ref(db, `/users/${dueledUserID}/moves`), (snapshot) => {
			if (!snapshot.exists()) return;
      const moves = (snapshot.val() as Move[]).slice(dueledUserOldMoves.length - 1)
			MAIN.applyMove(moves as Move[]);
		}); 
	});

	// scramblke cubes when you get scramble
	onValue(ref(db, `/users/${userID}/scramble`), (snapshot) => {
		if (!snapshot.exists()) return;
		scramble = snapshot.val();
		MAIN.scramble(scramble);
	});

	const allUserRef = ref(db, `users`);
	(
		document.getElementById("code") as HTMLSpanElement
	).innerHTML = `Your Code: ${code}`;
	form.addEventListener("submit", async (e) => {
		e.preventDefault();
		const formData = new FormData(form);

		const userList = await get(allUserRef);
		userList.forEach((child) => {
			if (child.child("code").toJSON() == formData.get("code")) {
				if (!child.hasChild("racing") && formData.get("code") != code) {
					// Code for when you make a connection to another person
					dueledUserRef = ref(db, `/users/${child.key}`);
					set(ref(db, `/users/${child.key}/racing`), userID);
					set(ref(db, `/users/${userID}/racing`), child.key);
					const s = SCRAMBLER.scramble("3x3").join(" ");
					set(ref(db, `/users/${child.key}/scramble`), s);
					set(ref(db, `/users/${userID}/scramble`), s);
				}
			}
		});
		if (!dueledUserRef) {
			alert("User not found");
		}
	});
}
