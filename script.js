// Paste your Firebase config here
// Your web app's Firebase configuration

const firebaseConfig = {

  apiKey: "AIzaSyABYcqyz8s5gqH7NVRwKurlsU9WfnXoS7A",

  authDomain: "cloudchat-bcbad.firebaseapp.com",

  projectId: "cloudchat-bcbad",

  storageBucket: "cloudchat-bcbad.firebasestorage.app",

  messagingSenderId: "966250985643",

  appId: "1:966250985643:web:5d4fe6b54e715388921fee"

};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get database reference
const database = firebase.database();
const chatRef = database.ref("messages");

// Send message
function sendMessage() {
    const username = document.getElementById("username").value;
    const message = document.getElementById("messageInput").value;

    if (username === "" || message === "") return;

    chatRef.push({
        name: username,
        text: message,
        timestamp: Date.now()
    });

    document.getElementById("messageInput").value = "";
}

// Listen for messages
chatRef.on("child_added", function(snapshot) {
    const data = snapshot.val();
    const chat = document.getElementById("chat");

    const messageElement = document.createElement("div");
    messageElement.classList.add("message");
    messageElement.innerHTML = "<strong>" + data.name + ":</strong> " + data.text;

    chat.appendChild(messageElement);
    chat.scrollTop = chat.scrollHeight;
});
