/** @typedef {import('pear-interface')} */ /* global Pear */

import Hyperswarm from "hyperswarm";
import crypto from "hypercore-crypto";
import b4a from "b4a";
const { teardown, updates } = Pear;

const swarm = new Hyperswarm();

teardown(() => swarm.destroy());

updates(() => Pear.reload());

let userList = [];
let creatorName = "";
let userName = ""; // Store the current user's name

// Declaration of Classes and Id's
const outerScreen = document.querySelector(".outerScreen");
const namePopUp = document.querySelector(".name--popUp");
const namePopUpInput = document.querySelector("#name--input");
const namePopUpBtn = document.querySelector(".namePopUpBtn");
const nameDisplay = document.querySelector(".name");

// Function to change the user's name and notify all peers
function changeName() {
  const newName = namePopUpInput.value.trim();
  if (newName === "") {
    alert("Enter the name first.");
    return;
  }

  // Update the user's name and display it
  userName = newName;
  nameDisplay.textContent = userName;

  // Hide the name input screen
  namePopUp.classList.add("hidden");
  outerScreen.classList.add("hidden");

  // Notify all peers of the name change
  const changeNameData = {
    type: "name",
    name: userName,
  };
  const messageBuffer = Buffer.from(JSON.stringify(changeNameData));
  const peers = [...swarm.connections];
  for (const peer of peers) peer.write(messageBuffer);

  // Update the local user list
  if (!userList.includes(userName)) {
    userList.push(userName);
    updateUserList();
  }
}

namePopUpBtn.addEventListener("click", changeName);

swarm.on("connection", (peer) => {
  // Send the local user's name to the new peer
  const nameData = {
    type: "name",
    name: userName,
  };
  peer.write(Buffer.from(JSON.stringify(nameData)));

  // Listen for incoming messages
  peer.on("data", (message) => {
    const data = JSON.parse(message.toString());
    if (data.type === "name") {
      // If it's a name message, add the name to the user list
      if (!userList.includes(data.name)) {
        userList.push(data.name);
        updateUserList();
      }
    } else if (data.type === "creator") {
      creatorName = data.name;
      updateUserList();
    } else if (data.type === "message") {
      if (data.to.includes(userName)) {
        document.querySelector(".notification").classList.remove("inactive");
        sendNotification(data.from, data.title);
      }
      onTodoAdd(
        data.id,
        data.from,
        data.to,
        data.title,
        data.message,
        data.categories
      );
    }
  });

  peer.on("error", (e) => console.log(`Connection Error: ${e}`));
});

swarm.on("update", () => {
  document.querySelector("#peers-count").textContent =
    swarm.connections.size + 1;
});

const createChatRoomBtn = document.querySelector("#create-chat-room");
const joinForm = document.querySelector("#join-form");
const messageForm = document.querySelector("#message-form");

createChatRoomBtn.addEventListener("click", createChatRoom);
joinForm.addEventListener("submit", joinChatRoom);
messageForm.addEventListener("submit", sendMessage);

async function createChatRoom() {
  document.querySelector(".name").classList.add("hidden");
  const topicBuffer = crypto.randomBytes(32);
  creatorName = userName;
  updateUserList();

  const creatorData = {
    type: "creator",
    name: creatorName,
  };

  const messageBuffer = Buffer.from(JSON.stringify(creatorData));

  const peers = [...swarm.connections];
  for (const peer of peers) peer.write(messageBuffer);

  console.log(`The room is created by ${creatorName}`);

  joinSwarm(topicBuffer);
}

async function joinChatRoom(e) {
  document.querySelector(".name").classList.add("hidden");
  e.preventDefault();
  const topicStr = document.querySelector("#join-chat-room-topic").value;
  const topicBuffer = b4a.from(topicStr, "hex");
  joinSwarm(topicBuffer);
}

async function joinSwarm(topicBuffer) {
  document.querySelector("#setup").classList.add("hidden");
  document.querySelector("#loading").classList.remove("hidden");

  const discovery = swarm.join(topicBuffer, { client: true, server: true });
  await discovery.flushed();

  const topic = b4a.toString(topicBuffer, "hex");
  document.querySelector("#chat-room-topic").innerHTML = topic;
  document.querySelector("#loading").classList.add("hidden");
  document.querySelector("#chat").classList.remove("hidden");
}

const todoPopUp = document.querySelector("#message-form");
const todoPopUpOpenBtn = document.querySelector(".todo--open--btn");
const todoPopUpCloseBtn = document.querySelector(".close--btn");

todoPopUpOpenBtn.addEventListener("click", (e) => {
  e.preventDefault();
  todoPopUp.classList.remove("hidden");
  outerScreen.classList.remove("hidden");
});
todoPopUpCloseBtn.addEventListener("click", (e) => {
  e.preventDefault();
  todoPopUp.classList.add("hidden");
  outerScreen.classList.add("hidden");
});

function sendMessage(e) {
  e.preventDefault();
  const title = document.querySelector("#title").value;
  const description = document.querySelector("#message").value;
  const to = document.querySelector("#to").value;

  const taggedUsers = to.match(/@\w+/g) || [];
  const parsedTaggedUsers = taggedUsers.map((tag) => tag.slice(1));

  const messageId = generateUniqueId();

  // Corrected line: Define form as messageForm
  const form = document.querySelector("#message-form");

  const selectedCategories = Array.from(form.elements.categories)
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);

  // Display the message locally
  const messageData = {
    type: "message",
    id: messageId,
    from: userName,
    to: parsedTaggedUsers,
    title: title,
    message: description,
    categories: selectedCategories,
  };
  onTodoAdd(messageId, "You", to, title, description, selectedCategories);
  const messageBuffer = Buffer.from(JSON.stringify(messageData));
  const peers = [...swarm.connections];
  for (const peer of peers) peer.write(messageBuffer);
}

function onTodoAdd(id, from, to, title, message, selectedCategories) {
  const todoItem = document.createElement("div");
  todoItem.classList.add("todo-item");
  todoItem.setAttribute("id", id);
  todoItem.innerHTML = `
  <span class="todo-item__from">Assigned By: ${from}</span>
    <span class="todo-item__to">Assigned To: ${to}</span>
    <span class="todo-item__title">${title}</span>
    <span class="todo-item__message">${message}</span>
  `;

  // Append categories to the categories container
  const categories = document.createElement("div");
  categories.classList.add("todo-item__categories");

  selectedCategories.forEach((category) => {
    const categorySpan = document.createElement("span");
    categorySpan.classList.add("todo-item__category");
    categorySpan.textContent = category;
    if (category === "Website") {
      categorySpan.style.backgroundColor = "#b3d5fe";
    } else if (category === "App") {
      categorySpan.style.backgroundColor = "#E4D0B4";
    } else if (category === "Software") {
      categorySpan.style.backgroundColor = "#E9FB91";
    } else if (category === "Design") {
      categorySpan.style.backgroundColor = "#BDACFF";
    } else if (category === "Personal") {
      categorySpan.style.backgroundColor = "#F4ACD1";
    } else {
      categorySpan.style.backgroundColor = "#bbb";
    }
    categories.appendChild(categorySpan); // Append each category to the categories container
  });

  // Append categories container to the todo item
  todoItem.appendChild(categories);
  document.querySelector("#messages").appendChild(todoItem);
}

function updateUserList() {
  const userListContainer = document.querySelector("#user-list");
  userListContainer.innerHTML = ""; // Clear the current list
  console.log(`Creator is : ${creatorName}`);

  userList.forEach((user) => {
    const $userDiv = document.createElement("p");
    const $admin = document.createElement("span");
    $admin.classList.add("tag");
    $userDiv.textContent = user;
    if (user === creatorName) {
      $admin.textContent = "Creator";
      $userDiv.appendChild($admin);
    }
    $userDiv.classList.add("user-list-item");
    userListContainer.appendChild($userDiv);
  });
}

const peerListBtn = document.querySelector(".peer--btn");
const peerListBtnCancel = document.querySelector(".peerListCancel");
const peerListPopUp = document.querySelector(".peerList");

peerListBtn.addEventListener("click", (e) => {
  e.preventDefault();
  outerScreen.classList.remove("hidden");
  peerListPopUp.classList.remove("hidden");
});

peerListBtnCancel.addEventListener("click", (e) => {
  e.preventDefault();
  outerScreen.classList.add("hidden");
  peerListPopUp.classList.add("hidden");
});

const dropdown = document.getElementById("dropdown");

// Show dropdown of matching members when "@" is typed
function showDropdown(query) {
  dropdown.innerHTML = ""; // Clear previous entries
  const filteredUsers = userList.filter((user) =>
    user.toLowerCase().startsWith(query)
  );

  // Populate dropdown with filtered users
  filteredUsers.forEach((user) => {
    const item = document.createElement("div");
    item.textContent = user;
    item.classList.add("dropdown-item");
    item.onclick = () => selectMember(user); // Add click event to select member
    dropdown.appendChild(item);
  });

  dropdown.classList.remove("hidden"); // Show dropdown
}

// Hide the dropdown
function hideDropdown() {
  dropdown.classList.add("hidden");
}

// Replace "@query" with selected username
function selectMember(member) {
  const inputField = document.querySelector("#to");
  const inputText = inputField.value;
  const atIndex = inputText.lastIndexOf("@");

  // Replace "@query" with "@member"
  inputField.value = inputText.slice(0, atIndex) + "@" + member + " ";
  hideDropdown(); // Hide dropdown after selection
}

document.querySelector("#to").addEventListener("keyup", (event) => {
  const inputText = event.target.value;
  const atIndex = inputText.lastIndexOf("@");

  if (atIndex !== -1) {
    const query = inputText.slice(atIndex + 1).toLowerCase();
    showDropdown(query);
  } else {
    hideDropdown();
  }
});

function sendNotification(from, title) {
  const notification = document.querySelector(".notification");

  // Reset notification visibility each time
  notification.classList.remove("inactive");
  notification.textContent = `${from} assigned you a task: ${title}`;

  setTimeout(() => {
    notification.classList.add("inactive");
  }, 5000);
}

function generateUniqueId() {
  return `todo-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}
