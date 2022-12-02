Round-trip tests: html -> markdown -> html
----

These tests run the complete `html -> markdown -> html` pipeline using
Semantic HTML in the format expected by the Helix pipeline as input.

The goal is to explore the details of this input format, and check
what's kept or lost in the double conversion.

The Helix Semantic HTML format is currently being defined, see

* https://github.com/adobe/helix-html2md/issues/4
* https://github.com/adobe/helix-html2md/discussions/6
* https://github.com/adobe/helix-html2md/discussions/7
* The tests and fixtures under https://github.com/adobe/helix-html2md/tree/main/test are a good way to find out what's supported.

These tests might lead to improvement proposals to help support the
various content types that we need to inject in the Content Bus.