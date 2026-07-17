chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.bookmarks.search({ url: tab.url }, function(results) {
      if (results && results.length > 0) {
        let bookmarkId = results[0].id;
        
    
        chrome.storage.sync.get({'clickStats': {}, 'lastUsedStats': {}}, function(data) {
          let clickStats = data.clickStats;
          let lastUsedStats = data.lastUsedStats;
          
          clickStats[bookmarkId] = (clickStats[bookmarkId] || 0) + 1;
          lastUsedStats[bookmarkId] = Date.now(); 
          
          chrome.storage.sync.set({
            'clickStats': clickStats, 
            'lastUsedStats': lastUsedStats
          });
        });
      }
    });
  }
});