/* =========================================================
   Shop locations: single source of truth
   ---------------------------------------------------------
   All shop details (address, phone, hours, order links) live in
   assets/data/locations.json. This script fills them into the page:

   1. Blocks:   <div data-loc-render="TYPE"></div>
      TYPE is one of:
        location-page   location.html cards + IceCreamShop schema
        home-shops      homepage "Our Shops" cards
        phone-list      list of shop phone numbers (About page)
        order-menu      <li> links for the Delivery/Pick Up menus
        cake-order      cake-order buttons grouped by area
        catering-order  catering-order buttons grouped by area

   2. Inline values inside text:
        <span data-loc="midtown" data-loc-field="street"></span>
      fields: name, shortName, street, cityLine, address, phone

   Header and mobile menu are loaded later by script.js, which calls
   ScoopLocations.apply(element) once they are in the page.
   ========================================================= */
(function () {
  "use strict";

  var DATA_URL = "assets/data/locations.json";
  var PAGE_PATH = "location.html";
  var dataPromise = null;

  /* ---------- helpers ---------- */

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // "23:00" -> "11:00 PM", "00:00" -> "12:00 AM"
  function formatTime(hhmm) {
    var parts = hhmm.split(":");
    var h = parseInt(parts[0], 10);
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ":" + parts[1] + " " + (h >= 12 ? "PM" : "AM");
  }

  function cityLine(a) { return a.city + ", " + a.state + " " + a.postalCode; }
  function fullAddress(a) { return a.street + ", " + cityLine(a); }
  function telHref(phone) { return "tel:+1" + phone.replace(/\D/g, ""); }
  function pageLink(loc) { return PAGE_PATH + "#" + loc.id; }

  function allLocations(data) {
    var list = [];
    data.regions.forEach(function (region) {
      region.locations.forEach(function (loc) { loc.region = region; list.push(loc); });
    });
    return list;
  }

  function findLocation(data, id) {
    return allLocations(data).filter(function (l) { return l.id === id; })[0];
  }

  function button(url, label) {
    return '<a href="' + esc(url) + '" target="_blank" rel="noopener" class="order-btn">' + esc(label) + "</a>";
  }

  /* ---------- renderers (each returns HTML for the container) ---------- */

  var renderers = {
    "location-page": function (data) {
      return data.regions.map(function (region) {
        var cards = region.locations.map(function (loc) {
          var hours = loc.hours.map(function (h) {
            return '<p class="timing">' + esc(h.label) + " : " + formatTime(h.opens) + " - " + formatTime(h.closes) + "</p>";
          }).join("");
          var links = [];
          if (loc.links.order) links.push(button(loc.links.order, "Scoop Deville"));
          if (loc.links.soupOrder) links.push(button(loc.links.soupOrder, "Soup Deville"));
          return (
            '<div class="col-lg-6 col-md-6 mt-4 mt-lg-5 mb-4">' +
              '<div class="location-details" id="' + esc(loc.id) + '">' +
                "<h4>" + esc(loc.name) + "</h4>" +
                '<p class="address">' + esc(fullAddress(loc.address)) + "</p>" +
                '<p class="contact"><a href="' + telHref(loc.phone) + '">' + esc(loc.phone) + "</a></p>" +
                hours +
                '<div class="mb-2 mt-4">' + links.join(" ") + "</div>" +
              "</div>" +
            "</div>"
          );
        }).join("");
        return (
          '<div class="container text-center pt-5">' +
            "<h3>" + esc(region.name) + "</h3>" +
            '<div class="row justify-content-center">' + cards + "</div>" +
          "</div>"
        );
      }).join("");
    },

    "home-shops": function (data) {
      return allLocations(data).map(function (loc) {
        var seasonal = loc.seasonal ? ' <span class="visually-hidden">(seasonal)</span>' : "";
        return (
          '<div class="col-xl-3 col-sm-6">' +
            '<div class="shop-card">' +
              '<div class="shop-band">' + esc(loc.region.area) + "</div>" +
              '<div class="shop-pin"><i class="fa-solid fa-location-dot" aria-hidden="true"></i></div>' +
              '<div class="shop-body">' +
                '<h3><a href="' + pageLink(loc) + '">' + esc(loc.shortName) + seasonal + "</a></h3>" +
                '<p class="shop-address">' + esc(loc.address.street) + "<br>" + esc(cityLine(loc.address)) + "</p>" +
                '<a href="' + telHref(loc.phone) + '" class="order-btn shop-phone"><i class="fa-solid fa-phone" aria-hidden="true"></i> ' + esc(loc.phone) + "</a>" +
                '<a href="' + pageLink(loc) + '" class="shop-more">Hours &amp; directions <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>' +
              "</div>" +
            "</div>" +
          "</div>"
        );
      }).join("");
    },

    "phone-list": function (data) {
      return allLocations(data).map(function (loc) {
        return '<a href="' + telHref(loc.phone) + '"><span>' + esc(loc.shortName) + "&nbsp;&nbsp; " + esc(loc.phone) + "</span></a>";
      }).join("");
    },

    "order-menu": function (data) {
      var locs = allLocations(data);
      var items = locs.filter(function (l) { return l.links.order; }).map(function (l) {
        return '<li><a href="' + esc(l.links.order) + '" target="_blank" rel="noopener">' + esc(l.name) + "</a></li>";
      });
      locs.filter(function (l) { return l.links.soupOrder; }).forEach(function (l) {
        items.push('<li><a href="' + esc(l.links.soupOrder) + '" target="_blank" rel="noopener">Soup Deville - ' + esc(l.shortName) + "</a></li>");
      });
      return items.join("");
    },

    "cake-order": function (data, el) { return orderGroups(data, "cakeOrder", el); },
    "catering-order": function (data, el) { return orderGroups(data, "cateringOrder", el); }
  };

  // Buttons grouped by area (Philadelphia / South Jersey), same markup as before.
  // Add data-loc-h1 to the container to make the first area title the page's <h1>.
  function orderGroups(data, linkKey, el) {
    var firstIsH1 = el && el.hasAttribute("data-loc-h1");
    return data.regions.map(function (region, i) {
      var buttons = region.locations.filter(function (l) { return l.links[linkKey]; }).map(function (l) {
        return button(l.links[linkKey], "Order " + l.shortName);
      });
      if (!buttons.length) return "";
      return (
        '<div class="col-lg-6 col-md-12 mt-4 mt-lg-5 mb-0 mb-lg-4">' +
          '<div class="location-details">' +
            '<div class="partner-content">' +
              (firstIsH1 && i === 0
                ? '<h1 class="h1-branch-title">' + esc(region.area) + "</h1>"
                : "<h2>" + esc(region.area) + "</h2>") +
              '<div class="margin-top flex-wrap">' + buttons.join("") + "</div>" +
            "</div>" +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  /* ---------- inline values ---------- */

  var fields = {
    name: function (l) { return l.name; },
    shortName: function (l) { return l.shortName; },
    street: function (l) { return l.address.street; },
    cityLine: function (l) { return cityLine(l.address); },
    address: function (l) { return fullAddress(l.address); },
    phone: function (l) { return l.phone; }
  };

  /* ---------- schema (location page only) ---------- */

  function buildSchema(data) {
    var brand = data.brand;
    var pageUrl = brand.siteUrl + PAGE_PATH;
    return {
      "@context": "https://schema.org",
      "@graph": allLocations(data).map(function (loc) {
        return {
          "@type": "IceCreamShop",
          "@id": pageUrl + "#" + loc.id,
          "name": brand.name + " " + loc.name,
          "url": pageUrl + "#" + loc.id,
          "image": brand.logo,
          "logo": brand.logo,
          "telephone": "+1-" + loc.phone,
          "servesCuisine": brand.servesCuisine,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": loc.address.street,
            "addressLocality": loc.address.city,
            "addressRegion": loc.address.state,
            "postalCode": loc.address.postalCode,
            "addressCountry": loc.address.country
          },
          "openingHoursSpecification": loc.hours.map(function (h) {
            return { "@type": "OpeningHoursSpecification", "dayOfWeek": h.days, "opens": h.opens, "closes": h.closes };
          }),
          "brand": { "@type": "Brand", "name": brand.name }
        };
      })
    };
  }

  function injectSchema(data) {
    if (document.getElementById("shop-schema")) return;
    var script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "shop-schema";
    script.text = JSON.stringify(buildSchema(data));
    document.head.appendChild(script);
  }

  // Cards are added after load, so jump to #wildwood etc. once they exist.
  function scrollToHash() {
    if (!location.hash) return;
    var target = document.getElementById(location.hash.slice(1));
    if (target) setTimeout(function () { target.scrollIntoView({ block: "center" }); }, 300);
  }

  /* ---------- main ---------- */

  function load() {
    if (!dataPromise) {
      dataPromise = fetch(DATA_URL).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      });
    }
    return dataPromise;
  }

  function apply(root) {
    root = root || document;
    var blocks = root.querySelectorAll("[data-loc-render]:not([data-loc-done])");
    var inline = root.querySelectorAll("[data-loc]:not([data-loc-done])");
    if (!blocks.length && !inline.length) return Promise.resolve();

    return load().then(function (data) {
      Array.prototype.forEach.call(blocks, function (el) {
        var type = el.getAttribute("data-loc-render");
        if (!renderers[type]) return console.warn("Unknown data-loc-render:", type);
        el.innerHTML = renderers[type](data, el);
        el.setAttribute("data-loc-done", "");
        if (type === "location-page") { injectSchema(data); scrollToHash(); }
      });
      Array.prototype.forEach.call(inline, function (el) {
        var loc = findLocation(data, el.getAttribute("data-loc"));
        var field = fields[el.getAttribute("data-loc-field") || "name"];
        if (loc && field) el.textContent = field(loc);
        el.setAttribute("data-loc-done", "");
      });
    }).catch(function (err) {
      console.error("Could not load shop locations:", err);
      Array.prototype.forEach.call(blocks, function (el) {
        if (el.getAttribute("data-loc-render") === "location-page" || el.getAttribute("data-loc-render") === "home-shops") {
          el.innerHTML = '<div class="container text-center pt-5"><p>Sorry, we couldn\'t load our locations right now. Please refresh the page.</p></div>';
        }
      });
    });
  }

  window.ScoopLocations = { load: load, apply: apply };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { apply(document); });
  } else {
    apply(document);
  }
})();
