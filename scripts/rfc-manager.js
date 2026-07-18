#!/usr/bin/env node

/**
 * RFC Manager Script
 *
 * Helps manage the RFC lifecycle including:
 * - Creating new RFCs
 * - Updating RFC status
 * - Generating RFC reports
 * - Validating RFC format
 */

const fs = require("fs");
const path = require("path");

const RFC_DIR = path.join(__dirname, "..", "docs", "rfc");
const RFC_TEMPLATE = `# RFC NNNN: Feature Name

- **Start Date**: ${new Date().toISOString().split("T")[0]}
- **RFC PR**: (leave this empty)
- **Implementation Issue**: (leave this empty)

## Summary

Brief explanation of the feature.

## Motivation

Why are we doing this? What use cases does it support? What is the expected outcome?

## Detailed Design

This is the bulk of the RFC. Explain the design in enough detail for somebody familiar with the framework to understand, and for somebody familiar with the implementation to implement.

## Drawbacks

Why should we *not* do this?

## Alternatives

What other designs have been considered? What is the impact of not doing this?

## Unresolved Questions

What parts of the design do you expect to resolve through the RFC process before this gets merged?

## Future Possibilities

What future work does this enable or make easier?

## Implementation Plan

### Phase 1: [Description]
- [ ] Task 1
- [ ] Task 2

### Phase 2: [Description]
- [ ] Task 1
- [ ] Task 2

## Success Metrics

How will we measure the success of this RFC?

- **Metric 1**: Target value
- **Metric 2**: Target value

## Conclusion

Summary of the RFC and why it should be accepted.

---

**Status**: Draft
**Assignee**: [Name]
**Reviewers**: [Names]
**Target Release**: [Version]
`;

class RFCManager {
    constructor() {
        this.ensureRFCDirectory();
    }

    ensureRFCDirectory() {
        if (!fs.existsSync(RFC_DIR)) {
            fs.mkdirSync(RFC_DIR, { recursive: true });
        }
    }

    getNextRFCNumber() {
        const files = fs.readdirSync(RFC_DIR);
        const rfcFiles = files.filter((f) => f.match(/^\d{4}-.*\.md$/));

        if (rfcFiles.length === 0) {
            return "0001";
        }

        const numbers = rfcFiles.map((f) => parseInt(f.substring(0, 4)));
        const maxNumber = Math.max(...numbers);
        return String(maxNumber + 1).padStart(4, "0");
    }

    createRFC(title) {
        const number = this.getNextRFCNumber();
        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .trim();

        const filename = `${number}-${slug}.md`;
        const filepath = path.join(RFC_DIR, filename);

        const content = RFC_TEMPLATE.replace("NNNN", number).replace("Feature Name", title);

        fs.writeFileSync(filepath, content);

        console.log(`✅ Created RFC ${number}: ${title}`);
        console.log(`📄 File: ${filepath}`);
        console.log(`🔗 Next steps:`);
        console.log(`   1. Edit the RFC file with your proposal`);
        console.log(`   2. Create a pull request for review`);
        console.log(`   3. Update the RFC index in docs/rfc/README.md`);

        return { number, filename, filepath };
    }

    listRFCs() {
        const files = fs.readdirSync(RFC_DIR);
        const rfcFiles = files.filter((f) => f.match(/^\d{4}-.*\.md$/));

        if (rfcFiles.length === 0) {
            console.log("📭 No RFCs found");
            return [];
        }

        console.log("📋 RFCs:");
        console.log("");

        const rfcs = rfcFiles.map((filename) => {
            const filepath = path.join(RFC_DIR, filename);
            const content = fs.readFileSync(filepath, "utf8");

            const number = filename.substring(0, 4);
            const titleMatch = content.match(/^# RFC \d+: (.+)$/m);
            const title = titleMatch ? titleMatch[1] : "Unknown Title";

            const statusMatch = content.match(/\*\*Status\*\*:\s*(.+)$/m);
            const status = statusMatch ? statusMatch[1].trim() : "Unknown";

            const assigneeMatch = content.match(/\*\*Assignee\*\*:\s*(.+)$/m);
            const assignee = assigneeMatch ? assigneeMatch[1].trim() : "Unassigned";

            console.log(`  ${number}: ${title}`);
            console.log(`         Status: ${status}`);
            console.log(`         Assignee: ${assignee}`);
            console.log(`         File: ${filename}`);
            console.log("");

            return { number, title, status, assignee, filename, filepath };
        });

        return rfcs;
    }

    updateRFCStatus(rfcNumber, newStatus) {
        const files = fs.readdirSync(RFC_DIR);
        const rfcFile = files.find((f) => f.startsWith(rfcNumber + "-"));

        if (!rfcFile) {
            console.error(`❌ RFC ${rfcNumber} not found`);
            return false;
        }

        const filepath = path.join(RFC_DIR, rfcFile);
        let content = fs.readFileSync(filepath, "utf8");

        // Update status line
        content = content.replace(/(\*\*Status\*\*:\s*)(.+)$/m, `$1${newStatus}`);

        fs.writeFileSync(filepath, content);

        console.log(`✅ Updated RFC ${rfcNumber} status to: ${newStatus}`);
        return true;
    }

    validateRFC(rfcNumber) {
        const files = fs.readdirSync(RFC_DIR);
        const rfcFile = files.find((f) => f.startsWith(rfcNumber + "-"));

        if (!rfcFile) {
            console.error(`❌ RFC ${rfcNumber} not found`);
            return false;
        }

        const filepath = path.join(RFC_DIR, rfcFile);
        const content = fs.readFileSync(filepath, "utf8");

        const requiredSections = [
            "Summary",
            "Motivation",
            "Detailed Design",
            "Drawbacks",
            "Alternatives",
            "Unresolved Questions",
        ];

        const issues = [];

        // Check for required sections
        requiredSections.forEach((section) => {
            if (!content.includes(`## ${section}`)) {
                issues.push(`Missing required section: ${section}`);
            }
        });

        // Check for placeholder text
        if (content.includes("Brief explanation of the feature")) {
            issues.push("Summary section contains placeholder text");
        }

        if (content.includes("Why are we doing this?")) {
            issues.push("Motivation section contains placeholder text");
        }

        // Check for RFC metadata
        if (!content.includes("**Start Date**:")) {
            issues.push("Missing start date");
        }

        if (!content.includes("**Status**:")) {
            issues.push("Missing status");
        }

        if (issues.length === 0) {
            console.log(`✅ RFC ${rfcNumber} validation passed`);
            return true;
        } else {
            console.log(`❌ RFC ${rfcNumber} validation failed:`);
            issues.forEach((issue) => console.log(`   - ${issue}`));
            return false;
        }
    }

    generateReport() {
        const rfcs = this.listRFCs();

        if (rfcs.length === 0) {
            return;
        }

        const statusCounts = rfcs.reduce((acc, rfc) => {
            acc[rfc.status] = (acc[rfc.status] || 0) + 1;
            return acc;
        }, {});

        console.log("📊 RFC Report:");
        console.log("");
        console.log("Status Distribution:");
        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`  ${status}: ${count}`);
        });
        console.log("");
        console.log(`Total RFCs: ${rfcs.length}`);
    }
}

// CLI Interface
function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const manager = new RFCManager();

    switch (command) {
        case "create":
            if (!args[1]) {
                console.error("❌ Please provide a title for the RFC");
                console.log('Usage: node rfc-manager.js create "RFC Title"');
                process.exit(1);
            }
            manager.createRFC(args[1]);
            break;

        case "list":
            manager.listRFCs();
            break;

        case "status":
            if (!args[1] || !args[2]) {
                console.error("❌ Please provide RFC number and new status");
                console.log('Usage: node rfc-manager.js status 0001 "Accepted"');
                process.exit(1);
            }
            manager.updateRFCStatus(args[1], args[2]);
            break;

        case "validate":
            if (!args[1]) {
                console.error("❌ Please provide RFC number");
                console.log("Usage: node rfc-manager.js validate 0001");
                process.exit(1);
            }
            manager.validateRFC(args[1]);
            break;

        case "report":
            manager.generateReport();
            break;

        default:
            console.log("RFC Manager - Manage RFC lifecycle");
            console.log("");
            console.log("Commands:");
            console.log("  create <title>     Create a new RFC");
            console.log("  list               List all RFCs");
            console.log("  status <num> <status>  Update RFC status");
            console.log("  validate <num>     Validate RFC format");
            console.log("  report             Generate RFC report");
            console.log("");
            console.log("Examples:");
            console.log('  node rfc-manager.js create "Import Wizard System"');
            console.log("  node rfc-manager.js list");
            console.log('  node rfc-manager.js status 0001 "Accepted"');
            console.log("  node rfc-manager.js validate 0001");
            console.log("  node rfc-manager.js report");
    }
}

if (require.main === module) {
    main();
}

module.exports = RFCManager;
