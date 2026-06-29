export const GRID_CELL = 40;

let collisionGrid = [];
let gridCols = 0;
let gridRows = 0;

export function initCollisionGrid(worldWidth, worldHeight) {
  gridCols = Math.ceil(worldWidth / GRID_CELL);
  gridRows = Math.ceil(worldHeight / GRID_CELL);
  collisionGrid = [];
  for (let r = 0; r < gridRows; r++) {
    collisionGrid[r] = [];
    for (let c = 0; c < gridCols; c++) {
      collisionGrid[r][c] = 0;
    }
  }
}

export function markObstacle(x, y, radius) {
  const col = Math.floor(x / GRID_CELL);
  const row = Math.floor(y / GRID_CELL);
  const cellRadius = Math.ceil(radius / GRID_CELL);
  for (let dr = -cellRadius; dr <= cellRadius; dr++) {
    for (let dc = -cellRadius; dc <= cellRadius; dc++) {
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < gridRows && c >= 0 && c < gridCols) {
        const dist = Math.hypot(dr * GRID_CELL, dc * GRID_CELL);
        if (dist <= radius + GRID_CELL * 0.5) {
          collisionGrid[r][c] = 1;
        }
      }
    }
  }
}

export function isWalkable(x, y) {
  const col = Math.floor(x / GRID_CELL);
  const row = Math.floor(y / GRID_CELL);
  if (row < 0 || row >= gridRows || col < 0 || col >= gridCols) return false;
  return collisionGrid[row][col] === 0;
}

export function gridPos(x, y) {
  return {
    col: Math.floor(x / GRID_CELL),
    row: Math.floor(y / GRID_CELL),
  };
}

export function worldPos(col, row) {
  return {
    x: col * GRID_CELL + GRID_CELL / 2,
    y: row * GRID_CELL + GRID_CELL / 2,
  };
}

export function aStar(startX, startY, endX, endY) {
  const start = gridPos(startX, startY);
  const end = gridPos(endX, endY);

  if (!isWalkable(endX, endY)) {
    const nearest = findNearestWalkable(endX, endY);
    if (!nearest) return null;
    end.col = nearest.col;
    end.row = nearest.row;
  }

  const openSet = [];
  const closedSet = new Set();
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  const key = (c, r) => `${c},${r}`;

  function h(c, r) {
    return Math.abs(c - end.col) + Math.abs(r - end.row);
  }

  openSet.push({ col: start.col, row: start.row });
  gScore.set(key(start.col, start.row), 0);
  fScore.set(key(start.col, start.row), h(start.col, start.row));

  while (openSet.length > 0) {
    let lowestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      const k = key(openSet[i].col, openSet[i].row);
      const kLow = key(openSet[lowestIdx].col, openSet[lowestIdx].row);
      if ((fScore.get(k) || Infinity) < (fScore.get(kLow) || Infinity)) {
        lowestIdx = i;
      }
    }

    const current = openSet[lowestIdx];
    if (current.col === end.col && current.row === end.row) {
      const path = [];
      let ck = key(current.col, current.row);
      while (cameFrom.has(ck)) {
        const parts = ck.split(",");
        const wp = worldPos(parseInt(parts[0]), parseInt(parts[1]));
        path.unshift({ x: wp.x, y: wp.y });
        ck = cameFrom.get(ck);
      }
      const sp = worldPos(start.col, start.row);
      path.unshift({ x: sp.x, y: sp.y });
      return path;
    }

    openSet.splice(lowestIdx, 1);
    closedSet.add(key(current.col, current.row));

    const dirs = [
      { dc: 0, dr: -1 }, { dc: 0, dr: 1 },
      { dc: -1, dr: 0 }, { dc: 1, dr: 0 },
      { dc: -1, dr: -1 }, { dc: 1, dr: -1 },
      { dc: -1, dr: 1 }, { dc: 1, dr: 1 },
    ];

    for (const d of dirs) {
      const nc = current.col + d.dc;
      const nr = current.row + d.dr;
      if (nc < 0 || nc >= gridCols || nr < 0 || nr >= gridRows) continue;
      if (closedSet.has(key(nc, nr))) continue;
      if (collisionGrid[nr] && collisionGrid[nr][nc] === 1) continue;

      const moveCost = (d.dc !== 0 && d.dr !== 0) ? 1.414 : 1;
      const tentativeG = (gScore.get(key(current.col, current.row)) || 0) + moveCost;

      if (!openSet.find(o => o.col === nc && o.row === nr)) {
        openSet.push({ col: nc, row: nr });
      } else if (tentativeG >= (gScore.get(key(nc, nr)) || Infinity)) {
        continue;
      }

      cameFrom.set(key(nc, nr), key(current.col, current.row));
      gScore.set(key(nc, nr), tentativeG);
      fScore.set(key(nc, nr), tentativeG + h(nc, nr));
    }
  }

  return null;
}

export function hasLineOfSight(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
  const steps = Math.max(Math.ceil(dx / GRID_CELL), Math.ceil(dy / GRID_CELL), 1);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t;
    if (!isWalkable(px, py)) return false;
  }
  return true;
}

export function simplifyPath(path) {
  if (!path || path.length <= 2) return path;
  const result = [path[0]];
  let anchor = 0;
  for (let i = 2; i < path.length; i++) {
    if (!hasLineOfSight(path[anchor].x, path[anchor].y, path[i].x, path[i].y)) {
      result.push(path[i - 1]);
      anchor = i - 1;
    }
  }
  result.push(path[path.length - 1]);
  return result;
}

export function findNearestWalkable(x, y, maxRadius = 5) {
  const center = gridPos(x, y);
  for (let r = 0; r <= maxRadius; r++) {
    for (let dc = -r; dc <= r; dc++) {
      for (let dr = -r; dr <= r; dr++) {
        if (Math.abs(dc) !== r && Math.abs(dr) !== r) continue;
        const nc = center.col + dc;
        const nr = center.row + dr;
        if (nc < 0 || nc >= gridCols || nr < 0 || nr >= gridRows) continue;
        if (collisionGrid[nr] && collisionGrid[nr][nc] === 0) {
          return { col: nc, row: nr };
        }
      }
    }
  }
  return null;
}
