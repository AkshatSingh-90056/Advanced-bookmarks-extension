import { getStorage, saveStorage, getBookmarks } from './data.js';


function getEditDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, 
          matrix[i][j - 1] + 1,     
          matrix[i - 1][j] + 1      
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

document.addEventListener('DOMContentLoaded', async function() {
  const list = document.getElementById('bookmark-list');
  const sortBtn = document.getElementById('sort-btn');
  const deleteBtn = document.getElementById('delete-btn');
  const themeToggle = document.getElementById('theme-toggle');
  const searchBar = document.getElementById('search-bar');
  const themeIcon = themeToggle.querySelector('.material-symbols-outlined');
  

  const exportBtn = document.getElementById('export-btn');
  const importFile = document.getElementById('import-file');

  const storage = await getStorage();
  let clickStats = storage.clickStats || {};
  let lastUsedStats = storage.lastUsedStats || {};
  let pinnedBookmarks = storage.pinnedBookmarks || {}; 

  if (storage.theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeIcon.textContent = 'dark_mode';
  }

  themeToggle.addEventListener('click', async () => {
    let currentTheme = document.documentElement.getAttribute('data-theme');
    let newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    themeIcon.textContent = newTheme === 'dark' ? 'dark_mode' : 'light_mode';
    await saveStorage('theme', newTheme);
  });

  let allBookmarks = await getBookmarks(clickStats);
  allBookmarks.sort((a, b) => b.clicks - a.clicks);

  function renderList(bookmarksToRender) {
    list.innerHTML = ''; 
    
    bookmarksToRender.forEach(bookmark => {
      let li = document.createElement('li');
      
      let pinBtn = document.createElement('button');
      pinBtn.className = `pin-btn ${pinnedBookmarks[bookmark.id] ? 'active' : ''}`;
      pinBtn.innerHTML = `<span class="material-symbols-outlined">keep</span>`;
      pinBtn.title = "Pin to protect from deletion";
      
      pinBtn.addEventListener('click', async () => {
        if (pinnedBookmarks[bookmark.id]) {
          delete pinnedBookmarks[bookmark.id];
          pinBtn.classList.remove('active');
        } else {
          pinnedBookmarks[bookmark.id] = true;
          pinBtn.classList.add('active');
        }
        await saveStorage('pinnedBookmarks', pinnedBookmarks);
      });

      let a = document.createElement('a');
      a.href = bookmark.url;
      a.textContent = bookmark.title || bookmark.url;
      a.target = "_blank"; 

 
      if (bookmark.url.startsWith('http://')) {
        let warning = document.createElement('span');
        warning.innerHTML = `<span class="material-symbols-outlined" style="color: var(--danger); font-size: 14px; margin-right: 5px;" title="Insecure Connection">warning</span>`;
        li.appendChild(warning);
      }
      
      let badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = bookmark.clicks;

      li.appendChild(pinBtn);
      li.appendChild(a);
      li.appendChild(badge);
      list.appendChild(li);
    });
  }

  renderList(allBookmarks);

 
  searchBar.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query.length === 0) {
      renderList(allBookmarks);
      return;
    }

    const filtered = allBookmarks.filter(b => {
      const title = (b.title || '').toLowerCase();
     
      if (title.includes(query)) return true;
      
     
      const distance = getEditDistance(query, title.substring(0, query.length));
      return distance <= 2;
    });
    
    renderList(filtered);
  });

  exportBtn.addEventListener('click', async () => {
    const backupData = await getStorage();
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    chrome.downloads.download({
      url: url,
      filename: "smart_bookmarks_backup.json"
    });
  });

 
  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(event) {
      try {
        const importedData = JSON.parse(event.target.result);
        if (importedData.clickStats) await saveStorage('clickStats', importedData.clickStats);
        if (importedData.lastUsedStats) await saveStorage('lastUsedStats', importedData.lastUsedStats);
        if (importedData.pinnedBookmarks) await saveStorage('pinnedBookmarks', importedData.pinnedBookmarks);
        
        alert("Backup restored successfully!");
        window.location.reload();
      } catch (err) {
        alert("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  });

 
  deleteBtn.addEventListener('click', function() {
    const twelveMonthsInMs = 365 * 24 * 60 * 60 * 1000;
    const cutoffDate = Date.now() - twelveMonthsInMs;
    
    let staleBookmarks = allBookmarks.filter(bookmark => {
      let lastActiveTime = lastUsedStats[bookmark.id] || bookmark.dateAdded;
      return lastActiveTime < cutoffDate && !pinnedBookmarks[bookmark.id]; 
    });
    
    if (staleBookmarks.length === 0) {
      alert("All clear! No unpinned bookmarks are older than 12 months.");
      return;
    }

    if (confirm(`Delete ${staleBookmarks.length} unpinned bookmarks inactive for over 12 months?`)) {
      let deleteCount = 0;
      staleBookmarks.forEach(bookmark => {
        chrome.bookmarks.remove(bookmark.id, () => {
          deleteCount++;
          if (deleteCount === staleBookmarks.length) {
            alert(`Successfully cleaned up ${deleteCount} bookmarks.`);
            window.location.reload(); 
          }
        });
      });
    }
  });


  sortBtn.addEventListener('click', function() {
    chrome.bookmarks.getChildren("1", function(children) {
      let barItems = children.map(node => {
        node.clicks = clickStats[node.id] || 0;
        return node;
      });

      barItems.sort((a, b) => b.clicks - a.clicks);
      barItems.forEach((item, newIndex) => {
        chrome.bookmarks.move(item.id, { parentId: "1", index: newIndex });
      });

      const originalContent = sortBtn.innerHTML;
      sortBtn.innerHTML = `<span class="material-symbols-outlined">check</span> Done!`;
      sortBtn.style.background = "#0f9d58"; 
      setTimeout(() => {
        sortBtn.innerHTML = originalContent;
        sortBtn.style.background = "var(--primary)"; 
      }, 2000);
    });
  });
});