// Utility functions for Ideas Portal theme
// Parses settings and determines if features should be enabled

// Parse enabled categories setting into array of numbers
export function parseCategories() {
  return settings.enabled_categories
    ? settings.enabled_categories.split("|")
        .map(id => parseInt(id, 10))
        .filter(id => !isNaN(id))
    : [];
}

// Parse enabled tags setting into array of strings
export function parseTags() {
  return settings.enabled_tags
    ? settings.enabled_tags.split("|")
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
    : [];
}

// Get current category if it's enabled, otherwise null
export function getCurrentCategory(api) {
  const discovery = api.container.lookup("service:discovery");
  if (!discovery?.category) {
    return null;
  }
  const cat = discovery.category;
  return parseCategories().includes(cat.id) ? cat : null;
}

// Get current tag if it's enabled, otherwise null
export function getCurrentTag(api) {
  const tags = parseTags();
  if (tags.length === 0) {
    return null;
  }
  const router = api.container.lookup("service:router");
  const currentRoute = router.currentRouteName;
  if (!currentRoute.includes("tag")) {
    return null;
  }
  // Try controller for tag page (newer Discourse)
  const tagCtrl = api.container.lookup("controller:tag.show");
  let currentTag;
  if (tagCtrl?.tag) {
    currentTag = tagCtrl.tag;
  } else {
    // Fallback: extract tag from URL
    // Handle both /tag/tagname and /tags/intersection/tagname/othertag patterns
    const intersectionMatch = window.location.pathname.match(/\/tags\/intersection\/([^\/]+)/);
    const tagMatch = window.location.pathname.match(/\/tag\/([^\/]+)/);

    if (intersectionMatch) {
      currentTag = intersectionMatch[1];
    } else if (tagMatch) {
      currentTag = tagMatch[1];
    }
  }
  return tags.includes(currentTag) ? currentTag : null;
}

// Determine if the portal should be enabled on this page
export function shouldEnable(api) {
  return !!getCurrentCategory(api) || !!getCurrentTag(api);
}