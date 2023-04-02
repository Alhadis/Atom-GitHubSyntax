<!--*-tab-width:4;indent-tabs-mode:t;fill-column:80-*-#vi:se ts=4 noet tw=80:-->
GitHub syntax theme for Atom
============================

This is a syntax highlighting theme for [Atom](https://atom.io/) that replicates
the exact appearance of highlighted source-code on GitHub.com. It was created to
facilitate development of TextMate-compatible grammars [for use on GitHub][1].

![Comparison between syntax theme and GitHub's styling (as of 2022-02-26)][2]


Features
--------
*	Automatic dark-mode detected from system settings.
*	Support for high-contrast and “dimmed” theme variants.
*	Support for [colourblind users][3] (protanopia, deuteranopia, tritanopia)
*	Pathologically-accurate highlighting (see next section)
*	Automated styling updates; run `tools/update-styles.sh` to update CSS.

To-do list
----------
*	[ ] Setup continuous integration
*	[ ] Write up contributor docs
*	[x] Add setting to enable manual dark/light-mode selection
*	[ ] Investigate supporting ChromeDriver for headless updates


TextMate vs CSS
---------------
[TextMate Scope Selectors](https://macromates.com/manual/en/scope_selectors) are
not completely compatible with [CSS classes](http://mdn.io/CSS/Class_selectors),
despite sharing a superficial resemblance:

	.string.quoted.double      CSS
	 string.quoted.double      TextMate

In CSS, the order in which classes are listed in a class selector is irrelevant:
`.string.quoted.double` is behaves the same as `.double.quoted.string`. TextMate
selectors, however, are sensitive to the order in which scopes are listed, which
means  `string.quoted` matches `string.quoted.double` but *not* `quoted.string`,
`string.foo.quoted`, or even `foo.string.quoted`.

### Why is this relevant?
GitHub uses TextMate selectors to map tokenised scope-lists onto CSS classes. In
rare cases, a grammar might specify a scope-list that TextMate and CSS selectors
interpret differently. For example, consider the following pattern:

~~~cson
name: "variable.global.other"
match: /\$\w+/
~~~

GitHub recognises both the `variable` and `variable.other` scopes, and assigns a
different colour to each. On GitHub, the aforementioned rule will be highlighted
as the former (`variable`), whereas a naïve theme targeting `.variable.other` in
CSS will see the latter.

### The solution
CSS provides no elegant way to implement an “order-dependent class selector”. An
ugly alternative is to use attribute selectors instead:

~~~less
// NB: This example omits the rebarbative `syntax--` prefix necessitated by Atom
:is([class="string quoted double"], [class^="string quoted double "]){
	
}
~~~

Astute authors will correctly note several limitations with this approach:

1.	**Classes must be separated by a single space (`U+0020`) only.**  
	Multiple spaces or other whitespace characters won't match.
2.	**`class` attributes cannot contain leading or trailing whitespace.**
3.	**Selectors must avoid matching more qualified scope-lists.**  
	E.g., `variable.other` should not inherit the styling applied to
	`variable`, or vice versa. This requires the inclusion of a `:not()`
	qualifier for every conflicting scope-list. For example:
	~~~less
	// Target "string" scope, but not more qualified selectors
	// such as "string.quoted.double" or "string.quoted.single"
	:is([class^="string "]):not(
		[class^="string quoted double"],
		[class^="string quoted single"]
	){ }
	~~~
4.	**The list of supported scopes must be known ahead-of-time.**  
	This is stipulated by the previous point.

Thankfully, each constraint is satisfied by Atom's [built-in use of Less][4] for
generating stylesheets. A [script][5] is provided for regenerating the scope-map
variables listed in [`scope-map.less`](styles/includes/scope-map.less).

### Related links
*	[Live preview of all TextMate scopes supported by GitHub][6]
*	[`textmate(5)` man page][7] documenting the TextMate grammar format.
*	[SCSS source][8] for Primer's various colour-themes. It's not directly
	used by this project out of an overabundance of caution—no assumptions
	are ever made about the stability of GitHub's pipeline and front-end.

<!-- Referenced links --------------------------------------------------------->
[1]: https://github.com/github/linguist/blob/HEAD/CONTRIBUTING.md
[2]: https://github.com/Alhadis/Atom-GitHubSyntax/blob/static/preview.svg?raw=1
[3]: https://github.com/github/roadmap/issues/357
[4]: http://bit.ly/3zqD0Br
[5]: ./tools/build-scope-map.mjs
[6]: https://git.io/Jf1IY
[7]: https://github.com/Alhadis/.files/blob/HEAD/share/man/man5/textmate.5
[8]: https://github.com/primer/css/tree/main/src/color-modes
