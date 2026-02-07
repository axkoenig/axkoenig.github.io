---
title: Learning or Compliance?
start_date: 2025-01-01
end_date: 2025-01-01
short_description: Investigating the role of learning and compliance in dexterous manipulation.
cover_image: media/funnel.png
highlight: false
collaborators:
  - name: "Adrian Sieler"
  - name: "Oliver Brock"
publications:
  - authors: ["A. Sieler", "A. Koenig", "O. Brock"]
    year: 2025
    title: "What Is the Key to Dexterous Manipulation: Learning or Compliance?"
    venue: "Proceedings of the German Robotics Conference (GRC)"
    resources:
      - label: "Paper"
        url: "https://www.static.tu.berlin/fileadmin/www/10002220/Publications/Sieler-Koenig-25-GRC.pdf"
      - label: "Slides"
        url: "media/2025-grc-compliance.pdf"
      - label: "Demo"
        url: "https://www.youtube.com/playlist?list=PLb-CNILz7vmtfNvvnbw58uElme1yGWYtL"
---

The below video first shows the degree of generality we obtain from compliance alone: we can robustly manipulate a cuboid in all wrist orientations, with an open-loop primtives which doesn't know which orientation the wrist is currently in. The video then demonstrates the self-stabilizing effect of a compliant hand.

<iframe width="560" height="315" src="https://www.youtube.com/embed/U6KgnqitfvY?si=pFftXujDkZJagjC5" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

### Abstract

> This abstract aims to spark a discussion on the key building block for dexterous manipulation: is it learning or compliance? While those are not the only building blocks, both have driven significant progress and merit discussion. An essential factor in addressing this question is evaluating both the generality of a solution and the cost associated with achieving this generality. To compare the two, this abstract looks at one axis of generality: the ability to execute a manipulation skill in different wrist orientations. We show that a compliant hand can perform an object rotation skill in varying wrist orientations at no additional cost. We explain that compliance enables self-stabilization, making it an ideal low-level building block for robust manipulation.

![Funnel visualization](media/funnel.png)