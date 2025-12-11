// javascripts/discourse/initializers/ideas-portal.js

import { apiInitializer } from "discourse/lib/api";
import {
  parseCategories,
  parseTags,
  getCurrentCategory,
  getCurrentTag,
  shouldEnable
} from "../lib/ideas-portal-utils";

export default apiInitializer("0.11.1", (api) => {
  const enabledCategories = parseCategories();
  const enabledTags = parseTags();

  let currentCategoryId = null;

  const tagMap = {
    'new': 'New',
    'under-review': 'Under Review',
    'planned': 'Planned',
    'planned-long-term': 'Planned Long-term',
    'in-progress': 'In Progress',
    'completed': 'Completed',
    'not-planned': 'Not Planned',
    'already-exists': 'Already Exists',
  };

  // Track if the user has interacted with filters
  const FILTER_CLICKED_STORAGE_KEY = 'ideas-portal-filter-clicked';
  const HOVER_DISMISS_COUNT_KEY = 'ideas-portal-hover-dismiss-count';
  const hasClickedFilter = () => localStorage.getItem(FILTER_CLICKED_STORAGE_KEY) === 'true';
  const markFilterAsClicked = () => localStorage.setItem(FILTER_CLICKED_STORAGE_KEY, 'true');

  // Track hover dismissals
  const getHoverDismissCount = () => parseInt(localStorage.getItem(HOVER_DISMISS_COUNT_KEY) || '0', 10);
  const incrementHoverDismissCount = () => {
    const count = getHoverDismissCount() + 1;
    localStorage.setItem(HOVER_DISMISS_COUNT_KEY, count.toString());
    return count;
  };

  // Determine if tip badge should show based on hover dismiss history
  const shouldShowTipBadge = () => {
    if (hasClickedFilter()) return false;

    const dismissCount = getHoverDismissCount();
    // Show less frequently as dismiss count increases:
    // 0-2 dismissals: always show
    // 3-5 dismissals: 50% chance
    // 6+ dismissals: 25% chance
    if (dismissCount <= 2) return true;
    if (dismissCount <= 5) return Math.random() < 0.5;
    return Math.random() < 0.25;
  };

  // Helper function to reset tip badge (for testing)
  window.resetIdeasTipBadge = () => {
    localStorage.removeItem(FILTER_CLICKED_STORAGE_KEY);
    localStorage.removeItem(HOVER_DISMISS_COUNT_KEY);
    console.log('Ideas Portal: Tip badge reset. Refresh the page to see it again.');
  };

  
  const fetchAllTopicsInCategory = async (categoryId) => {
    const pageSize = 100;
    let page = 0;
    let allTopics = [];
    let done = false;

    while (!done) {
      const response = await fetch(`/c/${categoryId}.json?page=${page}`);
      if (!response.ok) break;

      const data = await response.json();
      const topics = data.topic_list.topics || [];

      allTopics = allTopics.concat(topics);
      if (topics.length < pageSize) {
        done = true;
      } else {
        page++;
      }
    }

    return allTopics;
  };
  
  
  const fetchAllTopicsForTag = async (tagName) => {
    const pageSize = 30;
    let page = 0;
    let allTopics = [];
    let done = false;
  
    while (!done && page < 100) {
      const response = await fetch(`/tag/${tagName}.json?page=${page}`);
      if (!response.ok) break;
  
      const data = await response.json();
      const topics = data?.topic_list?.topics || [];
  
      allTopics = allTopics.concat(topics);
  
      if (topics.length < pageSize) {
        done = true;
      } else {
        page++;
      }
    }
  
    return allTopics;
  };
  

  const buildStatusCounts = (topics) => {
    const counts = {};
    Object.keys(tagMap).forEach(tag => counts[tag] = 0);

    topics.forEach(topic => {
      const tags = topic.tags || [];
      tags.forEach(tag => {
        if (counts.hasOwnProperty(tag)) {
          counts[tag]++;
        }
      });
    });

    return counts;
  };

  const createStatusVisualization = (statusCounts, container, categoryInfo = null) => {
    if (!container) return;

    container.innerHTML = '';
    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
  
    if (total === 0) {
      const noIdeasMessage = document.createElement('div');
      noIdeasMessage.className = 'no-ideas-message';
      noIdeasMessage.innerHTML = `
        <p>It looks like there are no ideas with this status yet.</p>
        <p>Be the first to submit an idea!</p>
      `;
      noIdeasMessage.style.textAlign = 'center';
      noIdeasMessage.style.padding = '20px';
      noIdeasMessage.style.color = 'var(--primary-medium)';
      noIdeasMessage.style.fontStyle = 'italic';
      container.appendChild(noIdeasMessage);
      container.style.display = 'block';
      return;
    } else {
      container.style.display = 'block';
    }
  
    const header = document.createElement('div');
    header.className = 'ideas-visualization-header';

    const chartContainer = document.createElement('div');
    chartContainer.style.height = '200px';
    chartContainer.style.width = '100%';
    chartContainer.style.position = 'relative';

    const canvas = document.createElement('canvas');
    canvas.id = 'ideas-status-chart';
    canvas.style.height = '100%';
    canvas.style.width = '100%';
    chartContainer.appendChild(canvas);

    container.appendChild(chartContainer);
  
    const labels = [], data = [], backgroundColors = [];

    // Ensure all statuses are included, even with a count of 0
    Object.keys(tagMap).forEach(status => {
      // Split multi-word labels into multiple lines for better display
      const labelText = tagMap[status];
      const words = labelText.split(' ');
      let label;

      // If label has multiple words, split into array for multi-line display
      if (words.length > 1) {
        label = words;  // Chart.js will render array as multi-line
      } else {
        label = labelText;
      }

      labels.push(label);  // Add label for every status
      data.push(statusCounts[status] || 0);  // Add count (0 if no topics for this status)
      let color;
      switch(status) {
        case 'new': color = 'rgba(0, 123, 255, 1)'; break;
        case 'planned': color = 'rgba(23, 162, 184, 1)'; break;
        case 'planned-long-term': color = 'rgba(111, 66, 193, 1)'; break;
        case 'in-progress': color = 'rgba(253, 126, 20, 1)'; break;
        case 'already-exists': color = 'rgba(108, 117, 125, 1)'; break;
        case 'under-review': color = 'rgba(32, 201, 151, 1)'; break;
        case 'completed': color = 'rgba(40, 167, 69, 1)'; break;
        case 'not-planned': color = 'rgba(220, 53, 69, 1)'; break;
        default: color = 'rgba(173, 181, 189, 1)';
      }
      backgroundColors.push(color);
    });
  
    if (window.ideasStatusChart) {
      window.ideasStatusChart.destroy();
      window.ideasStatusChart = null;
    }
  
    if (typeof Chart === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.onload = () => createBarChart(canvas, labels, data, backgroundColors, total, categoryInfo, statusCounts);
      document.head.appendChild(script);
    } else {
      createBarChart(canvas, labels, data, backgroundColors, total, categoryInfo, statusCounts);
    }
  };
  

  const updateChartTitle = (statusCounts, filterTag = null, categoryInfo = null) => {
    if (!window.ideasStatusChart) return;

    let count, title;
    const titleElement = document.getElementById('ideas-chart-main-title');
    const actionArea = document.getElementById('ideas-chart-action-area');

    if (filterTag && statusCounts[filterTag] !== undefined) {
      count = statusCounts[filterTag];
      const statusName = tagMap[filterTag];
      title = `${count} ${count === 1 ? 'Idea' : 'Ideas'} (${statusName})`;

      // Update the title element
      if (titleElement) {
        titleElement.textContent = title;
      }

      // Update action area to show "Show All" button
      if (actionArea && categoryInfo) {
        actionArea.innerHTML = '';
        const showAllButton = document.createElement('a');
        showAllButton.className = 'ideas-show-all-button-small';
        showAllButton.textContent = '✕ Show All';

        // Build the "show all" URL
        if (categoryInfo.isCategory) {
          const { parentSlug, categorySlug, categoryId } = categoryInfo;
          showAllButton.href = `/c/${parentSlug}${categorySlug}/${categoryId}`;
        } else if (categoryInfo.isTag) {
          showAllButton.href = `/tag/${categoryInfo.currentTag}`;
        }

        actionArea.appendChild(showAllButton);
      }

      // Dim other bars by reducing their opacity
      const chart = window.ideasStatusChart;
      const allStatuses = Object.keys(tagMap);
      const filterIndex = allStatuses.indexOf(filterTag);

      // Update opacity for each bar
      chart.data.datasets[0].backgroundColor = chart.data.datasets[0].backgroundColor.map((color, index) => {
        if (index === filterIndex) {
          return color; // Keep active bar at full opacity
        } else {
          // Dim other bars by adding transparency
          return color.replace('1)', '0.3)');
        }
      });

      // Update x-axis labels to bold the filtered label
      chart.options.scales.x.ticks.font = (ctx) => {
        const isActiveLabel = ctx.index === filterIndex;
        return {
          size: 16,
          weight: isActiveLabel ? 'bold' : 'normal'
        };
      };
    } else {
      count = Object.values(statusCounts).reduce((sum, c) => sum + c, 0);
      title = `${count} ${count === 1 ? 'Idea' : 'Ideas'}`;

      // Update the title element
      if (titleElement) {
        titleElement.textContent = title;
      }

      // Clear action area when not filtered
      if (actionArea) {
        actionArea.innerHTML = '';
      }

      // Reset all bars to full opacity
      const chart = window.ideasStatusChart;
      chart.data.datasets[0].backgroundColor = chart.data.datasets[0].backgroundColor.map((color) => {
        return color.replace(/[\d.]+\)$/, '1)');
      });

      // Reset x-axis labels to normal weight
      chart.options.scales.x.ticks.font = {
        size: 16,
        weight: 'normal'
      };
    }

    window.ideasStatusChart.update();
  };

  const createBarChart = (canvas, labels, data, backgroundColors, total, categoryInfo = null, statusCounts = null) => {
    // Detect if we're on a filtered page and calculate the appropriate title
    let chartTitle;
    let filterTag = null;

    const currentPath = window.location.pathname;
    const isFiltered = currentPath.includes('/tags/c/') && currentPath.split('/').length > 6 ||
                       currentPath.includes('/tags/intersection/');

    if (isFiltered && statusCounts) {
      // Try to extract the status tag from the URL
      const categoryTagMatch = currentPath.match(/\/tags\/c\/[^\/]+\/[^\/]+\/\d+\/([^\/]+)/);
      const intersectionMatch = currentPath.match(/\/tags\/intersection\/[^\/]+\/([^\/]+)/);

      if (categoryTagMatch && categoryTagMatch[1]) {
        filterTag = categoryTagMatch[1];
      } else if (intersectionMatch && intersectionMatch[1]) {
        filterTag = intersectionMatch[1];
      }

      // If we found a filter tag and it exists in our statusCounts, use filtered title
      if (filterTag && statusCounts[filterTag] !== undefined) {
        const count = statusCounts[filterTag];
        const statusName = tagMap[filterTag];
        chartTitle = `${count} ${count === 1 ? 'Idea' : 'Ideas'} (${statusName})`;
      } else {
        chartTitle = `${total} ${total === 1 ? 'Idea' : 'Ideas'}`;
      }
    } else {
      chartTitle = `${total} ${total === 1 ? 'Idea' : 'Ideas'}`;
    }

    // Using scriptable options for dynamic theme colors; no returnPrimaryColor helper needed

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create title and action bar area above the chart
    const titleContainer = document.createElement('div');
    titleContainer.className = 'ideas-chart-title-container';
    titleContainer.id = 'ideas-chart-title-container';

    const chartTitleElement = document.createElement('div');
    chartTitleElement.className = 'ideas-chart-main-title';
    chartTitleElement.id = 'ideas-chart-main-title';
    chartTitleElement.textContent = chartTitle;
    titleContainer.appendChild(chartTitleElement);

    // Add action area (either click indicator or show all button)
    const actionArea = document.createElement('div');
    actionArea.className = 'ideas-chart-action-area';
    actionArea.id = 'ideas-chart-action-area';

    // Check if we're on a filtered page (reusing variables from title calculation above)

    if (isFiltered && categoryInfo) {
      const showAllButton = document.createElement('a');
      showAllButton.className = 'ideas-show-all-button-small';
      showAllButton.textContent = '✕ Show All';

      // Build the "show all" URL
      if (categoryInfo.isCategory) {
        const { parentSlug, categorySlug, categoryId } = categoryInfo;
        showAllButton.href = `/c/${parentSlug}${categorySlug}/${categoryId}`;
      } else if (categoryInfo.isTag) {
        showAllButton.href = `/tag/${categoryInfo.currentTag}`;
      }

      actionArea.appendChild(showAllButton);
    }
    // Don't show anything in action area when not filtered - tip badge will handle it

    titleContainer.appendChild(actionArea);

    // Insert title at the beginning of the status visualization container
    const statusVisualizationContainer = canvas.parentElement.parentElement;
    statusVisualizationContainer.insertBefore(titleContainer, statusVisualizationContainer.firstChild);

    // Show floating tip badge if user hasn't clicked a filter before
    const showBadge = !isFiltered && shouldShowTipBadge();

    if (showBadge) {
      const tipBadge = document.createElement('div');
      tipBadge.className = 'ideas-tip-badge';

      // Create icon span with larger size and flip
      const iconSpan = document.createElement('span');
      iconSpan.className = 'ideas-tip-icon';
      iconSpan.textContent = '⌕';

      // Add text after icon
      tipBadge.appendChild(iconSpan);
      tipBadge.appendChild(document.createTextNode(' Click bars to filter'));

      // Position relative to chart container
      const chartContainerEl = canvas.parentElement;
      chartContainerEl.style.position = 'relative';
      chartContainerEl.appendChild(tipBadge);

      // Track cumulative hover time on chart bars
      let hoverTime = 0;
      let hoverInterval = null;
      let isHovering = false;

      const dismissBadge = (incrementCounter = false) => {
        if (tipBadge.parentElement) {
          tipBadge.classList.add('fade-out');
          setTimeout(() => {
            if (tipBadge.parentElement) {
              tipBadge.remove();
            }
          }, 500);
        }
        if (hoverInterval) {
          clearInterval(hoverInterval);
        }
        // Increment hover dismiss count if dismissed by hovering
        if (incrementCounter) {
          incrementHoverDismissCount();
        }
      };

      // Track hover time over the chart
      canvas.addEventListener('mouseenter', () => {
        isHovering = true;
        hoverInterval = setInterval(() => {
          if (isHovering) {
            hoverTime += 100;
            // Dismiss after 2 seconds (2000ms) of cumulative hover
            if (hoverTime >= 2000) {
              dismissBadge(true); // Pass true to increment counter
            }
          }
        }, 100);
      });

      canvas.addEventListener('mouseleave', () => {
        isHovering = false;
        if (hoverInterval) {
          clearInterval(hoverInterval);
          hoverInterval = null;
        }
      });

      // Mark as clicked and dismiss when user clicks on a bar
      canvas.addEventListener('click', (event) => {
        const elements = window.ideasStatusChart.getElementsAtEventForMode(
          event,
          'nearest',
          { intersect: true },
          false
        );

        if (elements.length > 0) {
          markFilterAsClicked();
          dismissBadge();
        }
      }, { once: true });
    }

    // Apply dimming to background colors if we're on a filtered page
    let displayBackgroundColors = backgroundColors;
    if (filterTag && statusCounts) {
      const allStatuses = Object.keys(tagMap);
      const filterIndex = allStatuses.indexOf(filterTag);

      displayBackgroundColors = backgroundColors.map((color, index) => {
        if (index === filterIndex) {
          return color; // Keep active bar at full opacity
        } else {
          // Dim other bars by adding transparency
          return color.replace('1)', '0.3)');
        }
      });
    }

    window.ideasStatusChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: displayBackgroundColors,
          borderColor: displayBackgroundColors.map(c => c.replace('0.7', '1').replace('0.3)', '1)')),
          borderWidth: 1,
          borderRadius: 0,
          borderSkipped: false,
          barPercentage: 0.7,        // Reduce bar width to 70% of category width
          categoryPercentage: 0.85   // Reduce category width to 85% of available space
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const statusKey = Object.keys(tagMap)[index];

            // Build the URL based on whether we're on a category or tag page
            let targetUrl;
            if (categoryInfo && categoryInfo.isCategory) {
              const { parentSlug, categorySlug, categoryId } = categoryInfo;
              targetUrl = `/tags/c/${parentSlug}${categorySlug}/${categoryId}/${statusKey}`;
            } else if (categoryInfo && categoryInfo.isTag) {
              const { currentTag } = categoryInfo;
              targetUrl = `/tags/intersection/${currentTag}/${statusKey}`;
            }

            if (targetUrl) {
              window.location.href = targetUrl;
            }
          }
        },
      plugins: {
          legend: {
            display: false
          },
        title: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleFont: { size: 13 },
            bodyFont: { size: 12 },
            displayColors: false,  // Remove color box from tooltip
            callbacks: {
              title: (context) => {
                // Convert array labels back to string with spaces
                const label = context[0].label;
                return Array.isArray(label) ? label.join(' ') : label;
              },
              label: (context) => {
                const count = context.raw;
                const percent = Math.round((count / data.reduce((a, b) => a + b, 0)) * 100);
                return `${count} ideas (${percent}%)`;
              }
            }
          }
        },
        scales: {
        x: {
          grid: {
            display: false,
            // optional scriptable grid color
            color: (ctx) => getComputedStyle(ctx.chart.canvas).getPropertyValue("--primary").trim(),
          },
          ticks: {
            color: (ctx) => getComputedStyle(ctx.chart.canvas).getPropertyValue("--primary").trim(),
              font: (ctx) => {
                const allStatuses = Object.keys(tagMap);
                const filterIndex = filterTag ? allStatuses.indexOf(filterTag) : -1;
                const isActiveLabel = filterIndex !== -1 && ctx.index === filterIndex;

                return {
                  size: 16,
                  weight: isActiveLabel ? 'bold' : 'normal'
                };
              }
            }
          },
        y: {
          beginAtZero: true,
          grid: {
            color: (ctx) => getComputedStyle(ctx.chart.canvas).getPropertyValue("--primary").trim(),
          },
          ticks: {
            precision: 0,
            color: (ctx) => getComputedStyle(ctx.chart.canvas).getPropertyValue("--primary").trim(),
              font: {
                size: 16
              }
            }
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'
        }
      }
    });
  };
  



  api.onPageChange(async () => {
    const shouldEnablePortal = shouldEnable(api);
    const existingFilters = document.querySelector('.ideas-tag-filters');

    // Hide categories nav on enabled tag pages
    if (getCurrentTag(api)) {
      const navItem = document.querySelector('.nav-item_categories');
      if (navItem) {
        navItem.style.display = 'none';
      }
    }

    if (!shouldEnablePortal) {
      document.body.classList.remove("ideas-portal-category");
      currentCategoryId = null;
      if (existingFilters) existingFilters.remove();
      if (window.ideasStatusChart) {
        window.ideasStatusChart.destroy();
        window.ideasStatusChart = null;
      }
      return;
    }

    const currentCategory = getCurrentCategory(api);
    
    // Use requestAnimationFrame to ensure the DOM is fully loaded
    requestAnimationFrame(() => {
      // Define an array of objects with the class and new text for each link
      const navLinks = [
        { className: "top", newText: "Most Active" },
        { className: "votes", newText: "Most Voted" },
        { className: "latest", newText: "Recently Active" },
      ];

      navLinks.forEach(({ className, newText }) => {
        // Select the <li> element with the specified class
        const listItem = document.querySelector(`li.${className}`);

        if (listItem) {
          // Select the <a> tag within the list item
          const link = listItem.querySelector("a");

          // Ensure the <a> tag exists and contains the expected text
          if (link && link.textContent.trim() === className.charAt(0).toUpperCase() + className.slice(1)) {
            link.textContent = newText;
          }
        }
      });

      // Replace "Topic" with "Ideas" in the topic list header
      const headerElement = document.querySelector('table.topic-list th.topic-list-data.default span');
      if (headerElement) {
        headerElement.textContent = "Ideas";
      }
    });

    if (existingFilters) {
      existingFilters.remove();
    }
    
    // Only set currentCategoryId if we're on a category page
    if (currentCategory) {
      currentCategoryId = currentCategory.id;
    }
    
    document.body.classList.add("ideas-portal-category");

        // Reorder status tags first in the topic list
        const statusTags = [
          "new",
          "under-review",
          "planned",
          "planned-long-term",
          "in-progress",
          "completed",
          "not-planned",
          "already-exists"
        ];
    
        requestAnimationFrame(() => {
          document.querySelectorAll("tr.topic-list-item").forEach(row => {
            const tagRow = row.querySelector(".discourse-tags");
            if (!tagRow) return;
        
            const statusTags = [
              "new", "under-review", "planned", "planned-long-term",
              "in-progress", "completed", "not-planned", "already-exists"
            ];
        
            // Get all tag <a> elements
            const tagElements = Array.from(tagRow.querySelectorAll("a.discourse-tag"));
        
            if (tagElements.length < 2) return; // no need to sort
        
            // Create a map of tagName -> original <a> element
            const tagMap = new Map(tagElements.map(el => [el.dataset.tagName, el]));
        
            // Sort tag names by status-first
            const sortedTagNames = [...tagMap.keys()].sort((a, b) => {
              const aIsStatus = statusTags.includes(a);
              const bIsStatus = statusTags.includes(b);
              if (aIsStatus && !bIsStatus) return -1;
              if (!aIsStatus && bIsStatus) return 1;
              return 0;
            });
        
            // Clear the container
            tagRow.innerHTML = "";
        
            // Append tags with correct spacing
            sortedTagNames.forEach((tagName, index) => {
              const el = tagMap.get(tagName);
              if (el) tagRow.appendChild(el);
            });
          });
        });
        
    
    // Apply tagMap text updates
    document.querySelectorAll('[data-tag-name]').forEach(el => {
      const tag = el.getAttribute('data-tag-name');
      if (tag && tagMap[tag]) {
        el.textContent = tagMap[tag];
      }
    });

    // Rest of the existing code for category pages
    if (currentCategory) {
      // Update banner title
      const bannerTitle = document.querySelector(".custom-banner__title");
      if (bannerTitle) {
        const originalTitle = bannerTitle.textContent.trim();
        let parentName = "";
        if (currentCategory.parent_category_id) {
          const siteCategories = api.container.lookup("site:main").categories;
          const parentCategory = siteCategories.find(cat => cat.id === currentCategory.parent_category_id);
          if (parentCategory) parentName = parentCategory.name;
        }
        if (parentName && !originalTitle.includes(currentCategory.name)) {
          bannerTitle.textContent = `${parentName} ${currentCategory.name}`;
        }
      }
    }

    // Render filters and chart
    const container = document.createElement('div');
    container.className = 'ideas-tag-filters';

    const statusVisualization = document.createElement('div');
    statusVisualization.className = 'ideas-status-visualization';
    container.appendChild(statusVisualization);

    if (currentCategory) {
      // Category-specific code
      const categorySlug = currentCategory.slug;
      let parentSlug = "";
      if (currentCategory.parent_category_id) {
        const siteCategories = api.container.lookup("site:main").categories;
        const parentCategory = siteCategories.find(cat => cat.id === currentCategory.parent_category_id);
        if (parentCategory) parentSlug = `${parentCategory.slug}/`;
      }

      // Try to fetch topics and create visualization
      try {
        const topics = await fetchAllTopicsInCategory(currentCategory.id);
        const statusCounts = buildStatusCounts(topics);

        // Pass category info for clickable bars
        const categoryInfo = {
          isCategory: true,
          parentSlug,
          categorySlug,
          categoryId: currentCategory.id
        };
        createStatusVisualization(statusCounts, statusVisualization, categoryInfo);

        // Check if we're on a filtered page and update chart title
        const currentPath = window.location.pathname;
        const tagMatch = currentPath.match(/\/tags\/c\/[^\/]+\/[^\/]+\/\d+\/([^\/]+)/);
        if (tagMatch && tagMatch[1]) {
          const activeTag = tagMatch[1];
          if (statusCounts[activeTag] !== undefined) {
            updateChartTitle(statusCounts, activeTag, categoryInfo);
          }
        }
      } catch (e) {
        console.error("Ideas Portal: Failed to load topics for static chart:", e);
      }
    } else {
      // Tag page specific code
      const currentTag = getCurrentTag(api);
      if (currentTag) {
        // Fetch and display visualization for tag page
        try {
          const topics = await fetchAllTopicsForTag(currentTag);
          const statusCounts = buildStatusCounts(topics);

          // Pass tag info for clickable bars
          const categoryInfo = {
            isTag: true,
            currentTag
          };
          createStatusVisualization(statusCounts, statusVisualization, categoryInfo);

          // Check if we're on a filtered tag intersection page
          const currentPath = window.location.pathname;
          const tagIntersectionMatch = currentPath.match(/\/tags\/intersection\/[^\/]+\/([^\/]+)/);
          if (tagIntersectionMatch && tagIntersectionMatch[1]) {
            const activeTag = tagIntersectionMatch[1];
            if (statusCounts[activeTag] !== undefined) {
              updateChartTitle(statusCounts, activeTag, categoryInfo);
            }
          }
        } catch (e) {
          console.error("Ideas Portal: Failed to load topics for tag chart:", e);
          // Show fallback message if chart creation fails
          const fallbackMessage = document.createElement('div');
          fallbackMessage.className = 'no-tag-visualization';
          fallbackMessage.innerHTML = `<p style="text-align: center; padding: 20px; color: var(--primary-medium); font-style: italic;">
            Unable to load ideas visualization for this tag.
          </p>`;
          statusVisualization.appendChild(fallbackMessage);
        }
      }
    }

    const target = document.querySelector('.navigation-container');
    if (target) {
      target.insertAdjacentElement('afterend', container);
    }
  });

  // Setup chart update on theme changes (OS preference and Discourse theme toggles)
  const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  function updateChart() {
    if (window.ideasStatusChart) {
      window.ideasStatusChart.update();
    }
  }
  // Listen for OS-level preference changes
  function handlePrefersChange(e) {
    updateChart();
  }
  if (darkMediaQuery.addEventListener) {
    darkMediaQuery.addEventListener('change', handlePrefersChange);
  } else if (darkMediaQuery.addListener) {
    darkMediaQuery.addListener(handlePrefersChange);
  }
  
  // Observe theme stylesheet changes and <link> toggles (e.g., theme toggle) to refresh chart
  const headObserver = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => {
          if (node.tagName === 'LINK') {
            updateChart();
          }
        });
      } else if (m.type === 'attributes' && m.target.tagName === 'LINK' && m.attributeName === 'disabled') {
        updateChart();
      }
    }
  });
  headObserver.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });

  // Observe all attribute changes on <html> to detect Discourse theme toggles
  const htmlObserver = new MutationObserver(mutations => {
    mutations.forEach(m => {
      const attr = m.attributeName;
      // On data-theme or data-user-theme or html class changes, update chart
      if (attr === 'data-theme' || attr === 'data-user-theme' || attr === 'class') {
        updateChart();
      }
    });
  });
  htmlObserver.observe(document.documentElement, { attributes: true, attributeOldValue: true });

  // Observe class changes on <body> as well
  const bodyObserver = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if (m.attributeName === 'class') {
        updateChart();
      }
    });
  });
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });

  // Fallback: periodically update chart to catch theme changes not detected by observers
  // Reduced interval to 1 second for faster response
  const chartUpdateInterval = setInterval(() => {
    if (window.ideasStatusChart) {
      window.ideasStatusChart.update();
    }
  }, 1000);
});
