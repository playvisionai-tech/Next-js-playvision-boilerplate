# Sections

The filename prefix is the section. This file defines the list, its ordering,
and each section's impact level.

## 1. Architecture (architecture)

**Impact:** CRITICAL
**Description:** Where code lives and which direction imports may point. The
boundaries that make the slices real rather than decorative.

## 2. Data (data)

**Impact:** CRITICAL
**Description:** Which storage tier owns a fact, how it is fetched, and what
invalidates it.

## 3. Security (security)

**Impact:** CRITICAL
**Description:** Access checks, headers, and secrets. Everything standing
between a request and data it should not see.

## 4. Quality (quality)

**Impact:** HIGH
**Description:** Standards that keep the codebase readable and reviewable.

## 5. Testing (testing)

**Impact:** HIGH
**Description:** Where tests live and what each layer is worth testing for.

## 6. CI (ci)

**Impact:** HIGH
**Description:** Verification order and what CI enforces that prose cannot.

## 7. Docs (docs)

**Impact:** HIGH
**Description:** Keeping the context layer honest as the code changes.

## 8. Reference (reference)

**Impact:** LOW
**Description:** Lookups, file locations, and local development setup.
