import { apiInitializer } from "discourse/lib/api";
import {
  parseCategories,
  getCurrentTag
} from "../lib/ideas-portal-utils";

export default apiInitializer("0.8", (api) => {
  const enabledCategories = parseCategories();
  const shouldEnableTagComposer = () => !!getCurrentTag(api);

  // Filter the categories in the category chooser ONLY on enabled tag pages
  api.modifyClass("component:category-chooser", {
    pluginId: "netwrix-ideas-category-filter",
  
    get content() {
      // Only filter categories if we're on an enabled tag page
      if (!shouldEnableTagComposer()) {
        return this.site.categories || [];
      }
  
      const enabledCategoryIds = enabledCategories;
  
      return (this.site.categories || []).filter(cat => enabledCategoryIds.includes(cat.id));
    }
  });

  // Add options to navigation dropdown via a class attribute
  // This uses a safer approach by marking the body with a class when enabled
  api.onPageChange(() => {
    if (shouldEnableTagComposer()) {
      document.body.classList.add("ideas-hide-category-badges");
      document.body.classList.add("ideas-filter-category-dropdown");
    } else {
      document.body.classList.remove("ideas-hide-category-badges");
      document.body.classList.remove("ideas-filter-category-dropdown");
    }
    
    // Safe way to filter the navigation dropdown categories
    // Add an observer to the DOM to apply filtering when the categories dropdown is opened
    if (shouldEnableTagComposer()) {
      setTimeout(() => {
        const categoryDropdownItems = document.querySelectorAll('.category-dropdown-menu .category');
        if (categoryDropdownItems && categoryDropdownItems.length > 0) {
          categoryDropdownItems.forEach(item => {
            const categoryId = item.getAttribute('data-category-id');
            if (categoryId && !enabledCategories.includes(parseInt(categoryId, 10))) {
              item.style.display = 'none';
            }
          });
        }
      }, 500); // Small delay to ensure the DOM is ready
    }
  });
});