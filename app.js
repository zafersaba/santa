const stage = document.getElementById("stage");
const collisionStatus = document.getElementById("collisionStatus");
const rotationRange = document.getElementById("rotationRange");
const rotationValue = document.getElementById("rotationValue");
const selectedTreeLabel = document.getElementById("selectedTree");

const trees = [];
const treeCount = 10;
const treeHeight = 96;
const treeWidth = treeHeight * 0.7;
const treeOrigin = { x: treeWidth / 2, y: treeHeight * 0.8 };
const treeShapeUnits = [
  [0.0, 0.8],
  [0.125, 0.5],
  [0.0625, 0.5],
  [0.2, 0.25],
  [0.1, 0.25],
  [0.35, 0.0],
  [0.075, 0.0],
  [0.075, -0.2],
  [-0.075, -0.2],
  [-0.075, 0.0],
  [-0.35, 0.0],
  [-0.1, 0.25],
  [-0.2, 0.25],
  [-0.0625, 0.5],
  [-0.125, 0.5],
];
const treeRadius = Math.max(
  ...treeShapeUnits.map(([x, y]) => Math.hypot(x * treeHeight, y * treeHeight))
);
const rootStyle = document.documentElement.style;
rootStyle.setProperty("--tree-height", `${treeHeight}px`);
rootStyle.setProperty("--tree-width", `${treeWidth}px`);
rootStyle.setProperty(
  "--tree-origin-y",
  `${(treeOrigin.y / treeHeight) * 100}%`
);
let selectedTree = null;
let dragging = null;
let dragOffset = { x: 0, y: 0 };

const randomBetween = (min, max) => Math.random() * (max - min) + min;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const updateCollisionStatus = (hasCollision) => {
  if (hasCollision) {
    collisionStatus.textContent = "Collision detected! Move the trees apart.";
    collisionStatus.classList.add("warning");
  } else {
    collisionStatus.textContent = "No collisions detected.";
    collisionStatus.classList.remove("warning");
  }
};

const setSelectedTree = (tree) => {
  if (selectedTree) {
    selectedTree.element.classList.remove("selected");
  }
  selectedTree = tree;
  if (selectedTree) {
    selectedTree.element.classList.add("selected");
    rotationRange.value = selectedTree.rotation;
    rotationValue.textContent = `${selectedTree.rotation} deg`;
    selectedTreeLabel.textContent = selectedTree.label;
  } else {
    rotationRange.value = 0;
    rotationValue.textContent = "0 deg";
    selectedTreeLabel.textContent = "None";
  }
};

const checkCollisions = () => {
  let collision = false;
  trees.forEach((tree) => tree.element.classList.remove("colliding"));

  for (let i = 0; i < trees.length; i += 1) {
    for (let j = i + 1; j < trees.length; j += 1) {
      const a = trees[i];
      const b = trees[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.hypot(dx, dy);
      if (distance < treeRadius * 2) {
        a.element.classList.add("colliding");
        b.element.classList.add("colliding");
        collision = true;
      }
    }
  }

  updateCollisionStatus(collision);
};

const positionTree = (tree, x, y) => {
  const bounds = stage.getBoundingClientRect();
  const minX = treeOrigin.x;
  const minY = treeOrigin.y;
  const maxX = bounds.width - (treeWidth - treeOrigin.x);
  const maxY = bounds.height - (treeHeight - treeOrigin.y);
  tree.x = clamp(x, minX, maxX);
  tree.y = clamp(y, minY, maxY);
  tree.element.style.left = `${tree.x - treeOrigin.x}px`;
  tree.element.style.top = `${tree.y - treeOrigin.y}px`;
};

const updateRotation = (tree, rotation) => {
  tree.rotation = rotation;
  tree.element.style.transform = `rotate(${rotation}deg)`;
};

const createTree = (index) => {
  const element = document.createElement("div");
  element.className = "tree";
  element.dataset.index = index;
  const label = `Tree ${index + 1}`;
  element.setAttribute("aria-label", label);
  element.style.width = `${treeWidth}px`;
  element.style.height = `${treeHeight}px`;

  const tree = {
    element,
    x: 0,
    y: 0,
    rotation: 0,
    label,
  };

  element.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const bounds = stage.getBoundingClientRect();
    dragging = tree;
    dragOffset = {
      x: event.clientX - bounds.left - tree.x,
      y: event.clientY - bounds.top - tree.y,
    };
    setSelectedTree(tree);
    element.setPointerCapture(event.pointerId);
  });

  element.addEventListener("pointerup", () => {
    dragging = null;
  });

  element.addEventListener("pointermove", (event) => {
    if (!dragging || dragging !== tree) {
      return;
    }
    const bounds = stage.getBoundingClientRect();
    const x = event.clientX - bounds.left - dragOffset.x;
    const y = event.clientY - bounds.top - dragOffset.y;
    positionTree(tree, x, y);
    checkCollisions();
  });

  stage.appendChild(element);
  return tree;
};

const initializeTrees = () => {
  const bounds = stage.getBoundingClientRect();
  for (let i = 0; i < treeCount; i += 1) {
    const tree = createTree(i);
    const x = randomBetween(
      treeOrigin.x,
      bounds.width - (treeWidth - treeOrigin.x)
    );
    const y = randomBetween(
      treeOrigin.y,
      bounds.height - (treeHeight - treeOrigin.y)
    );
    positionTree(tree, x, y);
    updateRotation(tree, Math.floor(randomBetween(0, 360)));
    trees.push(tree);
  }
  setSelectedTree(trees[0]);
  checkCollisions();
};

rotationRange.addEventListener("input", (event) => {
  if (!selectedTree) {
    return;
  }
  const value = Number(event.target.value);
  rotationValue.textContent = `${value} deg`;
  updateRotation(selectedTree, value);
});

window.addEventListener("resize", () => {
  trees.forEach((tree) => positionTree(tree, tree.x, tree.y));
  checkCollisions();
});

initializeTrees();
