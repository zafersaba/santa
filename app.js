const stage = document.getElementById("stage");
const collisionStatus = document.getElementById("collisionStatus");
const rotationRange = document.getElementById("rotationRange");
const rotationValue = document.getElementById("rotationValue");
const selectedTreeLabel = document.getElementById("selectedTree");
const squareSizeLabel = document.getElementById("squareSize");
const treeCountInput = document.getElementById("treeCountInput");

const trees = [];
let treeCount = 10;
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
const rootStyle = document.documentElement.style;
rootStyle.setProperty("--tree-height", `${treeHeight}px`);
rootStyle.setProperty("--tree-width", `${treeWidth}px`);
rootStyle.setProperty(
  "--tree-origin-y",
  `${(treeOrigin.y / treeHeight) * 100}%`
);
const boundingSquare = document.createElement("div");
boundingSquare.id = "boundingSquare";
stage.appendChild(boundingSquare);
let selectedTree = null;
let dragging = null;
let dragOffset = { x: 0, y: 0 };

const randomBetween = (min, max) => Math.random() * (max - min) + min;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const buildPolygon = (tree) => {
  const rad = (tree.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Convert unit coordinates (origin at base center, +y upward) into stage coordinates.
  return treeShapeUnits.map(([ux, uy]) => {
    const px = ux * treeHeight;
    const py = -uy * treeHeight;
    const rx = px * cos - py * sin;
    const ry = px * sin + py * cos;
    return { x: tree.x + rx, y: tree.y + ry };
  });
};

const segmentsIntersect = (p1, p2, q1, q2) => {
  const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const onSegment = (a, b, c) =>
    Math.min(a.x, b.x) <= c.x &&
    c.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= c.y &&
    c.y <= Math.max(a.y, b.y);

  const o1 = orient(p1, p2, q1);
  const o2 = orient(p1, p2, q2);
  const o3 = orient(q1, q2, p1);
  const o4 = orient(q1, q2, p2);

  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, p2, q2)) return true;
  if (o3 === 0 && onSegment(q1, q2, p1)) return true;
  if (o4 === 0 && onSegment(q1, q2, p2)) return true;

  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
};

const pointInPolygon = (point, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const polygonsIntersect = (a, b) => {
  // Quick AABB check
  const bbox = (poly) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    poly.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
    return { minX, minY, maxX, maxY };
  };
  const boxA = bbox(a);
  const boxB = bbox(b);
  if (
    boxA.maxX < boxB.minX ||
    boxB.maxX < boxA.minX ||
    boxA.maxY < boxB.minY ||
    boxB.maxY < boxA.minY
  ) {
    return false;
  }

  // Edge intersection
  for (let i = 0; i < a.length; i += 1) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j += 1) {
      const b1 = b[j];
      const b2 = b[(j + 1) % b.length];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }

  // Containment
  if (pointInPolygon(a[0], b)) return true;
  if (pointInPolygon(b[0], a)) return true;

  return false;
};

const updateBoundingSquare = (polygons) => {
  if (!polygons.length) {
    boundingSquare.style.width = "0px";
    boundingSquare.style.height = "0px";
    squareSizeLabel.textContent = "--";
    return;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  polygons.forEach((poly) => {
    poly.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
  });

  const width = maxX - minX;
  const height = maxY - minY;
  const side = Math.max(width, height);

  const left = width >= height ? minX : minX - (side - width) / 2;
  const top = height >= width ? minY : minY - (side - height) / 2;

  boundingSquare.style.left = `${left}px`;
  boundingSquare.style.top = `${top}px`;
  boundingSquare.style.width = `${side}px`;
  boundingSquare.style.height = `${side}px`;

  const rounded = Math.round(side * 10) / 10;
  squareSizeLabel.textContent = `${rounded}px`;
};

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

  const polygons = trees.map(buildPolygon);
  for (let i = 0; i < trees.length; i += 1) {
    for (let j = i + 1; j < trees.length; j += 1) {
      const a = trees[i];
      const b = trees[j];
      if (polygonsIntersect(polygons[i], polygons[j])) {
        a.element.classList.add("colliding");
        b.element.classList.add("colliding");
        collision = true;
      }
    }
  }

  updateCollisionStatus(collision);
  updateBoundingSquare(polygons);
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
  // Clear existing tree elements
  stage.querySelectorAll(".tree").forEach((el) => el.remove());
  trees.length = 0;
  selectedTree = null;
  updateBoundingSquare([]);

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
   checkCollisions();
});

window.addEventListener("resize", () => {
  trees.forEach((tree) => positionTree(tree, tree.x, tree.y));
  checkCollisions();
});

treeCountInput.addEventListener("change", (event) => {
  const value = Math.round(Number(event.target.value));
  const clamped = clamp(value, Number(treeCountInput.min), Number(treeCountInput.max));
  treeCount = clamped;
  treeCountInput.value = clamped;
  initializeTrees();
});

initializeTrees();
