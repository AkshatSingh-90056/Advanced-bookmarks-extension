export async function getStorage() {
 
  return await chrome.storage.sync.get(['theme', 'clickStats', 'lastUsedStats', 'pinnedBookmarks']);
}

export async function saveStorage(key, value) {
  
  await chrome.storage.sync.set({ [key]: value });
}

export async function getBookmarks(clickStats) {
  const tree = await chrome.bookmarks.getTree();
  function extractLinks(nodes) {
    let links = [];
    for (let node of nodes) {
      if (node.url) {
        node.clicks = clickStats[node.id] || 0;
        links.push(node);
      }
      if (node.children) {
        links = links.concat(extractLinks(node.children));
      }
    }
    return links;
  }
  return extractLinks(tree);
}