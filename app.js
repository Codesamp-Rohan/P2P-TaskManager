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

// Object to store comments for each todoId
const commentsData = {};

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
    let msg = "Enter the name first.";
    alertNotification(msg);
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

function getDaysLeft(endDate) {
  const today = new Date();
  const end = new Date(endDate);

  const timeDiff = end - today;

  const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  if (daysLeft > 0) {
    return `${daysLeft} days left`;
  } else if (daysLeft === 0) {
    return "Ends today";
  } else {
    return "Expired";
  }
}

swarm.on("connection", (peer) => {
  // Send the local user's name to the new peer
  const nameData = {
    type: "name",
    name: userName,
  };
  peer.write(Buffer.from(JSON.stringify(nameData)));

  if (creatorName) {
    const creatorData = {
      type: "creator",
      name: creatorName,
    };
    peer.write(Buffer.from(JSON.stringify(creatorData)));
  }

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
        data.startDate,
        data.endDate,
        data.categories
      );
    } else if (data.type === "deleteTodo") {
      deleteTodoItem(data.id);
    } else if (data.type === "editTodo") {
      const todoItem = document.getElementById(data.id);
      if (todoItem) {
        todoItem.querySelector(".todo-item__title").textContent = data.title;
        todoItem.querySelector(".todo-item__message").textContent =
          data.message;
        todoItem.querySelector(".todo-item__to").textContent = `To: ${data.to}`;

        // Update categories display
        const categoriesContainer = todoItem.querySelector(
          ".todo-item__categories"
        );
        categoriesContainer.innerHTML = "";
        data.categories.forEach((category) => {
          const categorySpan = document.createElement("span");
          categorySpan.classList.add("todo-item__category");
          categorySpan.textContent = category;
          if (category === "Website") {
            categorySpan.style.backgroundColor = "#b3d5fe";
            categorySpan.style.color = "#2662ab";
          } else if (category === "App") {
            categorySpan.style.backgroundColor = "#ffcc84ab";
            categorySpan.style.color = "#a66000";
          } else if (category === "Software") {
            categorySpan.style.backgroundColor = "#E9FB91";
            categorySpan.style.color = "#729d00";
          } else if (category === "Design") {
            categorySpan.style.backgroundColor = "#BDACFF";
          } else if (category === "Personal") {
            categorySpan.style.backgroundColor = "#F4ACD1";
          } else {
            categorySpan.style.backgroundColor = "#bbb";
            categorySpan.style.color = "#000";
          }
          categoriesContainer.appendChild(categorySpan);
        });
      }
    } else if (data.type === "pinTodo") {
      pinTodoItem(data.id);
    } else if (data.type === "comment") {
      displayComment(data);
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
  let title = document.querySelector("#title").value;
  let description = document.querySelector("#message").value;
  let to = document.querySelector("#to").value;
  let startDate = document.querySelector("#start-date").value;
  let endDate = document.querySelector("#end-date").value;

  if (title === "") {
    alertNotification("Please enter a title for your task.");
  } else if (description === "") {
    alertNotification("Please enter a description for your task.");
  } else {
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
      startDate: startDate,
      endDate: endDate,
      categories: selectedCategories,
    };
    onTodoAdd(
      messageId,
      "You",
      to,
      title,
      description,
      startDate,
      endDate,
      selectedCategories
    );
    const messageBuffer = Buffer.from(JSON.stringify(messageData));
    const peers = [...swarm.connections];
    for (const peer of peers) peer.write(messageBuffer);
  }
}

function onTodoAdd(
  id,
  from,
  to,
  title,
  message,
  startDate,
  endDate,
  selectedCategories
) {
  const todoItem = document.createElement("div");
  todoItem.classList.add("todo-item");
  todoItem.setAttribute("id", id);
  todoItem.style.position = "relative"; // Ensure the todo-item is the relative parent
  const creationTime = new Date();
  console.log(creationTime);

  const timeLeft = getDaysLeft(endDate);

  todoItem.innerHTML = `
  <span class="todo-item__title" style="margin-bottom: 10px;">${title}</span>
  <span class="todo-item__message">${message}</span>
    <div class="todo-item-fromto-div">
      <span class="todo-item__from">By: ${from}</span>
      <span class="todo-item__to">To: ${to}</span>
    </div>
    <div class="todo-item__days-left"><img src="./assets/clock.png" class="logo"/>${timeLeft}</div>
  `;

  // Categories container
  const categories = document.createElement("div");
  categories.classList.add("todo-item__categories");

  selectedCategories.forEach((category) => {
    const categorySpan = document.createElement("span");
    categorySpan.classList.add("todo-item__category");
    categorySpan.textContent = category;
    // Set category colors
    if (category === "Website") {
      categorySpan.style.backgroundColor = "#b3d5fe";
      categorySpan.style.color = "#2662ab";
    } else if (category === "App") {
      categorySpan.style.backgroundColor = "#ffcc84ab";
      categorySpan.style.color = "#a66000";
    } else if (category === "Software") {
      categorySpan.style.backgroundColor = "#E9FB91";
      categorySpan.style.color = "#729d00";
    } else if (category === "Design") {
      categorySpan.style.backgroundColor = "#BDACFF";
    } else if (category === "Personal") {
      categorySpan.style.backgroundColor = "#F4ACD1";
    } else {
      categorySpan.style.backgroundColor = "#bbb";
      categorySpan.style.color = "#000";
    }
    categories.appendChild(categorySpan);
  });

  // Todo Menu container
  const todoMenu = document.createElement("div");
  todoMenu.classList.add("todo-item__menu");

  // Delete button
  const deleteBtn = document.createElement("button");
  const deleteBtnImg = document.createElement("img");
  deleteBtnImg.src = "./assets/delete.png";
  deleteBtnImg.classList.add("logo");
  deleteBtn.classList.add("delete-btn");
  deleteBtn.classList.add("menuBtn");
  deleteBtn.textContent = "Delete";
  deleteBtn.appendChild(deleteBtnImg);
  deleteBtn.addEventListener("click", (e) => {
    e.preventDefault();
    deleteTodoItem(id);

    const deleteTodoData = {
      type: "deleteTodo",
      id: id,
    };

    const messageBuffer = Buffer.from(JSON.stringify(deleteTodoData));

    const peers = [...swarm.connections];
    for (const peer of peers) peer.write(messageBuffer);
  });

  // Edit button
  const editBtn = document.createElement("button");
  const editBtnImg = document.createElement("img");
  editBtnImg.src = "./assets/edit.png";
  editBtnImg.classList.add("logo");
  editBtn.classList.add("edit-btn");
  editBtn.classList.add("menuBtn");
  editBtn.textContent = "Edit";
  editBtn.appendChild(editBtnImg);
  editBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openEditForm(id, title, message, to, selectedCategories); // Open edit form with the todo details
  });

  const pinBtn = document.createElement("button");
  const pinBtnImg = document.createElement("img");
  pinBtnImg.src = "./assets/pin.png";
  pinBtnImg.classList.add("logo");
  pinBtn.classList.add("pin-btn");
  pinBtn.classList.add("menuBtn");
  pinBtn.textContent = "Pin";
  pinBtn.appendChild(pinBtnImg);
  pinBtn.addEventListener("click", (e) => {
    e.preventDefault();
    pinTodoItem(id);
    const pinData = {
      type: "pinTodo",
      id: id,
    };

    const messageBuffer = Buffer.from(JSON.stringify(pinData));

    const peers = [...swarm.connections];
    for (const peer of peers) peer.write(messageBuffer);
  });

  todoMenu.appendChild(deleteBtn);
  todoMenu.appendChild(editBtn);
  todoMenu.appendChild(pinBtn);

  // Menu button to toggle todoMenu
  const todoMenuBtn = document.createElement("button");
  todoMenuBtn.classList.add("todo-item__menu_btn");

  todoMenuBtn.addEventListener("click", (e) => {
    e.preventDefault();
    todoMenu.classList.toggle("show"); // Toggle visibility
  });

  const todoMenuImg = document.createElement("img");
  todoMenuImg.classList.add("logo");
  todoMenuImg.src = "./assets/menu.png";

  todoMenuBtn.appendChild(todoMenuImg);
  todoItem.appendChild(todoMenuBtn);

  // Append categories and the entire todo item to messages
  todoItem.appendChild(categories);
  todoItem.appendChild(todoMenu); // Attach the menu to the todo item
  document.querySelector("#messages").appendChild(todoItem);
}

function deleteTodoItem(id) {
  console.log(`${id} is the id of this particular todo.`);
  const todoItem = document.getElementById(id);
  if (todoItem) {
    todoItem.remove();
    console.log(`Deleted the todo with id : ${id}`);
  }
}

function openEditForm(todoId, title, message, to, categories) {
  const editForm = document.querySelector("#edit-form");
  const titleInput = editForm.querySelector("#title");
  const messageInput = editForm.querySelector("#message");
  const toInput = editForm.querySelector("#to");

  // Populate the edit form with existing values
  titleInput.value = title;
  messageInput.value = message;
  toInput.value = to;

  const categoryCheckboxes = editForm.querySelectorAll(
    "input[name='categories']"
  );
  categoryCheckboxes.forEach((checkbox) => {
    checkbox.checked = categories.includes(checkbox.value);
  });

  // Show the edit form and save the current todo ID for updating
  editForm.classList.remove("hidden");
  outerScreen.classList.remove("hidden");

  editForm.setAttribute("data-todo-id", todoId);
}

function pinTodoItem(id) {
  const todoItem = document.getElementById(id);
  const pinMsg = todoItem.querySelector(".pin");

  if (pinMsg) {
    todoItem.removeChild(pinMsg);
  } else {
    const newPinMsg = document.createElement("span");
    newPinMsg.classList.add("pin");
    newPinMsg.textContent = "📌";
    todoItem.appendChild(newPinMsg);
  }
}

document.querySelector("#edit-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const editForm = e.target;
  const todoId = editForm.getAttribute("data-todo-id");
  const newTitle = editForm.querySelector("#title").value;
  const newMessage = editForm.querySelector("#message").value;
  const newTo = editForm.querySelector("#to").value;

  const updatedCategories = Array.from(
    editForm.querySelectorAll("input[name='categories']:checked")
  ).map((checkbox) => checkbox.value);

  if (!newTitle || !newMessage) {
    alertNotification("Title and description cannot be empty.");
    return;
  }

  // Update the todo item locally
  const todoItem = document.getElementById(todoId);
  if (todoItem) {
    todoItem.querySelector(".todo-item__title").textContent = newTitle;
    todoItem.querySelector(".todo-item__message").textContent = newMessage;
    todoItem.querySelector(".todo-item__to").textContent = `To: ${newTo}`;

    // Update categories display
    const categoriesContainer = todoItem.querySelector(
      ".todo-item__categories"
    );
    categoriesContainer.innerHTML = "";
    updatedCategories.forEach((category) => {
      const categorySpan = document.createElement("span");
      categorySpan.classList.add("todo-item__category");
      categorySpan.textContent = category;
      if (category === "Website") {
        categorySpan.style.backgroundColor = "#b3d5fe";
        categorySpan.style.color = "#2662ab";
      } else if (category === "App") {
        categorySpan.style.backgroundColor = "#ffcc84ab";
        categorySpan.style.color = "#a66000";
      } else if (category === "Software") {
        categorySpan.style.backgroundColor = "#E9FB91";
        categorySpan.style.color = "#729d00";
      } else if (category === "Design") {
        categorySpan.style.backgroundColor = "#BDACFF";
      } else if (category === "Personal") {
        categorySpan.style.backgroundColor = "#F4ACD1";
      } else {
        categorySpan.style.backgroundColor = "#bbb";
        categorySpan.style.color = "#000";
      }
      categoriesContainer.appendChild(categorySpan);
    });
  }

  // Broadcast the edit to peers
  const editTodoData = {
    type: "editTodo",
    id: todoId,
    title: newTitle,
    message: newMessage,
    to: newTo,
    categories: updatedCategories,
  };

  const messageBuffer = Buffer.from(JSON.stringify(editTodoData));
  const peers = [...swarm.connections];
  for (const peer of peers) peer.write(messageBuffer);

  // Hide the edit form
  editForm.classList.add("hidden");
  outerScreen.classList.add("hidden");
});

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

function alertNotification(msg) {
  const notification = document.createElement("alert");
  notification.classList.remove("inactive");
  notification.textContent = msg;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add("inactive");
  }, 5000);
}

function generateUniqueId() {
  return `todo-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

const filterDropdown = document.getElementById("todo-filter");
filterDropdown.addEventListener("change", (event) => {
  filterTodos(event.target.value);
});

// Filter Todos
function filterTodos(filter) {
  const todos = document.querySelectorAll(".todo-item");

  todos.forEach((todo) => {
    const isPinned = todo.querySelector(".pin") !== null;
    const taggedUsers = todo
      .querySelector(".todo-item__to")
      .textContent.includes("@");

    if (filter === "all") {
      todo.style.display = "block";
    } else if (filter === "pinned" && isPinned) {
      todo.style.display = "block";
    } else if (filter === "tagged" && taggedUsers) {
      todo.style.display = "block";
    } else {
      todo.style.display = "none";
    }
  });
}

const extendTodo = document.querySelector(".extendTodo");
const extendTodoClose = document.querySelector(".extendTodo--cancel");

extendTodoClose.addEventListener("click", (e) => {
  e.preventDefault();
  outerScreen.classList.add("hidden");
  extendTodo.classList.add("closeExtendTodo");
});

function showTodoDetails(id, title, message, from, to, categories) {
  const extendTodo = document.querySelector(".extendTodo");
  extendTodo.setAttribute("id", id);

  const todoCommentsDiv = document.querySelector(".extendTodo--comment");
  todoCommentsDiv.innerHTML = "";

  // Load and display comments for the current todo
  if (commentsData[id]) {
    commentsData[id].forEach(displayComment);
  }

  // Select elements inside extendTodo to populate them with the todo details
  const extendTodoTitle = document.querySelector(".extendTodo--title");
  const extendTodoPara = document.querySelector(".extendTodo--para");
  const extendTodoCategories = document.querySelector(".extendTodo--cat");

  // Populate title and message
  extendTodoTitle.textContent = title;
  extendTodoPara.textContent = message;

  // Clear existing categories and add new ones
  extendTodoCategories.innerHTML = ""; // Clear previous categories
  categories.forEach((category) => {
    const categorySpan = document.createElement("span");
    categorySpan.textContent = category;
    extendTodoCategories.appendChild(categorySpan);
  });

  // Optionally, populate additional information like the 'from' and 'to' details
  // For example, if you have a dedicated section for 'from' and 'to' in extendTodo
  const extendTodoFrom = document.querySelector(".extendTodo--from");
  const extendTodoTo = document.querySelector(".extendTodo--to");

  if (extendTodoFrom) extendTodoFrom.textContent = `From: ${from}`;
  if (extendTodoTo) extendTodoTo.textContent = `To: ${to}`;
}

// Event delegation: listen for clicks on `.todo-item` within `#messages`
document.querySelector("#messages").addEventListener("click", (e) => {
  const todo = e.target.closest(".todo-item");
  if (
    todo &&
    !e.target.closest(".menuBtn") &&
    !e.target.closest(".todo-item__menu_btn")
  ) {
    e.preventDefault();
    outerScreen.classList.remove("hidden");

    const todoId = todo.id;

    // Retrieve the details of the todo item
    const title = todo.querySelector(".todo-item__title").textContent;
    const message = todo.querySelector(".todo-item__message").textContent;
    const from = todo.querySelector(".todo-item__from").textContent;
    const to = todo.querySelector(".todo-item__to").textContent;

    // Collect categories if they exist
    const categoryElements = todo.querySelectorAll(".todo-item__category");
    const categories = Array.from(categoryElements).map(
      (cat) => cat.textContent
    );

    // Show the todo details in the extendTodo section
    showTodoDetails(todoId, title, message, from, to, categories);

    // Show the extendTodo section
    const extendTodo = document.querySelector(".extendTodo");
    extendTodo.classList.remove("closeExtendTodo");
  }
});

document
  .querySelector(".extendTodo--commentInput")
  .addEventListener("submit", (e) => {
    e.preventDefault();
    sendComment();
  });

function sendComment() {
  const comment = document
    .querySelector(".extendTodo--commentInput--input")
    .value.trim();
  const todoId = document.querySelector(".extendTodo").getAttribute("id");

  if (!comment) return;

  const commentData = {
    type: "comment",
    todoId,
    comment: comment,
    author: userName,
  };

  if (!commentsData[todoId]) {
    commentsData[todoId] = [];
  }
  commentsData[todoId].push(commentData);

  displayComment(commentData);

  const messageBuffer = Buffer.from(JSON.stringify(commentData));
  swarm.connections.forEach((peer) => peer.write(messageBuffer));
  document.querySelector(".extendTodo--commentInput--input").value = "";
}

function displayComment({ todoId, comment, author }) {
  const extendTodo = document.querySelector(".extendTodo");
  if (extendTodo.getAttribute("id") === todoId) {
    const todoCommentsDiv = document.querySelector(".extendTodo--comment");
    const commentEl = document.createElement("p");
    commentEl.innerHTML = `<strong>${author}:</strong> ${comment}`;
    todoCommentsDiv.appendChild(commentEl);
  }
}
