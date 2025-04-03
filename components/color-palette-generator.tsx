"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { HexColorPicker } from "react-colorful"
import { Download, Check, Copy, RefreshCw, AlertCircle, Palette, Zap, Code, Sun, Moon } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { useTheme } from "next-themes"
import { Label } from "@/components/ui/label"
import { motion } from "framer-motion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ColorShade {
  shade: number
  hex: string
  hue: number
  saturation: number
  lightness: number
}

interface ContrastScore {
  background: ColorShade
  foreground: ColorShade
  ratio: number
  level: string
  pass: boolean
}

export default function ColorPaletteGenerator() {
  const [baseColor, setBaseColor] = useState("#169BED")
  const [vibrancy, setVibrancy] = useState(50)
  const [hueShift, setHueShift] = useState(0)
  const [colorShades, setColorShades] = useState<ColorShade[]>([])
  const [copiedHex, setCopiedHex] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState(baseColor)
  const [isRandomizing, setIsRandomizing] = useState(false)
  const [activeTab, setActiveTab] = useState("palette")
  const [isDarkMode, setIsDarkMode] = useState(true)
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

  // Convert hex to HSL - memoized for performance
  const hexToHSL = useCallback((hex: string): [number, number, number] => {
    // Remove the # if present
    hex = hex.replace(/^#/, "")

    // Parse the hex values
    const r = Number.parseInt(hex.substring(0, 2), 16) / 255
    const g = Number.parseInt(hex.substring(2, 4), 16) / 255
    const b = Number.parseInt(hex.substring(4, 6), 16) / 255

    // Find min and max values
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)

    // Calculate lightness
    let l = (max + min) / 2

    let h = 0
    let s = 0

    if (max !== min) {
      // Calculate saturation
      s = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min)

      // Calculate hue
      if (max === r) {
        h = (g - b) / (max - min) + (g < b ? 6 : 0)
      } else if (max === g) {
        h = (b - r) / (max - min) + 2
      } else {
        h = (r - g) / (max - min) + 4
      }
      h /= 6
    }

    // Convert to degrees, percentage, percentage
    h = Math.round(h * 360)
    s = Math.round(s * 100)
    l = Math.round(l * 100)

    return [h, s, l]
  }, [])

  // Convert HSL to hex - memoized for performance
  const hslToHex = useCallback((h: number, s: number, l: number): string => {
    h /= 360
    s /= 100
    l /= 100

    let r, g, b

    if (s === 0) {
      r = g = b = l
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1 / 6) return p + (q - p) * 6 * t
        if (t < 1 / 2) return q
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
        return p
      }

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q

      r = hue2rgb(p, q, h + 1 / 3)
      g = hue2rgb(p, q, h)
      b = hue2rgb(p, q, h - 1 / 3)
    }

    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16)
      return hex.length === 1 ? "0" + hex : hex
    }

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
  }, [])

  // Generate color shades - memoized to prevent unnecessary recalculations
  const generateColorShades = useCallback(() => {
    const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]
    const [baseHue, baseSat, baseLight] = hexToHSL(baseColor)

    // Apply hue shift
    const adjustedHue = (baseHue + hueShift + 360) % 360

    // Apply vibrancy (affects saturation)
    // Cap vibrancy to prevent issues with extreme values
    const cappedVibrancy = Math.min(vibrancy, 85) // Cap at 85% to prevent oversaturation
    const saturationMultiplier = cappedVibrancy / 50 // 0-85 range to 0-1.7 multiplier

    const newShades = shades.map((shade) => {
      // Fixed lightness values to ensure proper gradient
      // These values ensure 50 is always lightest and 900 is always darkest
      const lightnessMap: Record<number, number> = {
        50: 96, // Lightest
        100: 90,
        200: 80,
        300: 70,
        400: 60,
        500: 50,
        600: 40,
        700: 30,
        800: 20,
        900: 10, // Darkest
      }

      const targetLightness = lightnessMap[shade]

      // Calculate saturation with a more controlled approach
      // Lighter shades get less saturation, darker shades get more
      let adjustedSaturation: number

      if (shade <= 100) {
        // Very light shades (50, 100) get significantly reduced saturation
        adjustedSaturation = baseSat * saturationMultiplier * (0.3 + shade / 500)
      } else if (shade < 500) {
        // Medium-light shades get moderately reduced saturation
        adjustedSaturation = baseSat * saturationMultiplier * (0.6 + shade / 1000)
      } else if (shade < 800) {
        // Medium-dark shades get slightly increased saturation
        adjustedSaturation = baseSat * saturationMultiplier * (0.9 + (shade - 500) / 2000)
      } else {
        // Very dark shades (800, 900) get reduced saturation to prevent muddiness
        adjustedSaturation = baseSat * saturationMultiplier * 0.95
      }

      // Cap saturation to prevent oversaturation
      adjustedSaturation = Math.min(adjustedSaturation, 100)

      // Generate the hex color
      const hex = hslToHex(adjustedHue, adjustedSaturation, targetLightness)

      return {
        shade,
        hex,
        hue: adjustedHue,
        saturation: Math.round(adjustedSaturation),
        lightness: targetLightness,
      }
    })

    return newShades
  }, [baseColor, vibrancy, hueShift, hexToHSL, hslToHex])

  // Memoize color shades to prevent unnecessary re-renders
  const memoizedColorShades = useMemo(() => generateColorShades(), [generateColorShades])

  // Update color shades when dependencies change
  useEffect(() => {
    setColorShades(memoizedColorShades)
  }, [memoizedColorShades])

  // Reset copied state after 1 second (reduced from 2 seconds)
  useEffect(() => {
    if (copiedHex) {
      const timeout = setTimeout(() => {
        setCopiedHex(null)
      }, 1000)
      return () => clearTimeout(timeout)
    }
  }, [copiedHex])

  // Update input value when baseColor changes from other sources
  useEffect(() => {
    setInputValue(baseColor)
  }, [baseColor])

  // Set dark mode as default and sync the switch state
  useEffect(() => {
    // Initialize the switch state based on the current theme
    setIsDarkMode(theme === "dark")
  }, [theme])

  // Copy hex value to clipboard
  const copyToClipboard = (hex: string) => {
    navigator.clipboard.writeText(hex)
    setCopiedHex(hex)
    toast({
      title: "Copied to clipboard",
      description: `${hex} has been copied to your clipboard.`,
      duration: 1000, // Reduced from 2000ms
    })
  }

  // Download palette as JSON
  const downloadPalette = () => {
    const palette = colorShades.reduce(
      (acc, { shade, hex }) => {
        acc[shade] = hex
        return acc
      },
      {} as Record<number, string>,
    )

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(palette, null, 2))
    const downloadAnchorNode = document.createElement("a")
    downloadAnchorNode.setAttribute("href", dataStr)
    downloadAnchorNode.setAttribute("download", `palette-${baseColor.replace("#", "")}.json`)
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
  }

  // Download palette as CSS
  const downloadCSS = () => {
    let css = `:root {\n`
    colorShades.forEach(({ shade, hex }) => {
      css += `  --color-primary-${shade}: ${hex};\n`
    })
    css += `}\n`

    const dataStr = "data:text/css;charset=utf-8," + encodeURIComponent(css)
    const downloadAnchorNode = document.createElement("a")
    downloadAnchorNode.setAttribute("href", dataStr)
    downloadAnchorNode.setAttribute("download", `palette-${baseColor.replace("#", "")}.css`)
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
  }

  // Download palette as Tailwind config
  const downloadTailwindConfig = () => {
    const colors = colorShades.reduce(
      (acc, { shade, hex }) => {
        acc[shade] = hex
        return acc
      },
      {} as Record<number, string>,
    )

    const config = `/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: ${JSON.stringify(colors, null, 6).replace(/"([^"]+)":/g, "$1:")}
      }
    }
  }
}`

    const dataStr = "data:text/javascript;charset=utf-8," + encodeURIComponent(config)
    const downloadAnchorNode = document.createElement("a")
    downloadAnchorNode.setAttribute("href", dataStr)
    downloadAnchorNode.setAttribute("download", `tailwind-config-${baseColor.replace("#", "")}.js`)
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
  }

  // Format and validate hex value - memoized for performance
  const formatHexValue = useCallback(
    (value: string): string => {
      // Remove any non-hex characters
      let hex = value.replace(/[^0-9A-Fa-f]/g, "")

      // If empty, return the current base color
      if (!hex) return baseColor

      // Handle shorthand hex (e.g., "F00" -> "FF0000")
      if (hex.length === 3) {
        hex = hex
          .split("")
          .map((char) => char + char)
          .join("")
      }

      // Complete incomplete hex values
      if (hex.length < 6) {
        // Pad with zeros or repeat the pattern
        if (hex.length === 1) {
          // Single character - repeat it (e.g., "F" -> "FFFFFF")
          hex = hex.repeat(6)
        } else if (hex.length === 2) {
          // Two characters - treat as RR and repeat (e.g., "FF" -> "FFFF00")
          hex = hex + hex + "00"
        } else if (hex.length === 4) {
          // Four characters - treat as RRGG and add default blue (e.g., "FFFF" -> "FFFF00")
          hex = hex + "00"
        } else if (hex.length === 5) {
          // Five characters - add one more from the pattern
          hex = hex + hex.charAt(0)
        }
      } else if (hex.length > 6) {
        // Truncate if too long
        hex = hex.substring(0, 6)
      }

      return "#" + hex.toUpperCase()
    },
    [baseColor],
  )

  // Handle theme toggle with faster transition
  const handleThemeToggle = (checked: boolean) => {
    setIsDarkMode(checked)
    const newTheme = checked ? "dark" : "light"
    document.documentElement.classList.add("theme-transition")
    setTheme(newTheme)

    // Apply v0.dev style transition
    if (checked) {
      document.documentElement.style.setProperty("--background-color-transition", "rgb(8, 8, 8)")
    } else {
      document.documentElement.style.setProperty("--background-color-transition", "rgb(255, 255, 255)")
    }

    // Remove transition class after animation completes
    setTimeout(() => {
      document.documentElement.classList.remove("theme-transition")
    }, 300)
  }

  // Generate a random color with more variation and reset sliders
  const randomizeColor = () => {
    // Set randomizing state for animation
    setIsRandomizing(true)

    // Reset vibrancy and hue shift to default values
    setVibrancy(50)
    setHueShift(0)

    // Decide whether to make a completely random color (30% chance) or stay somewhat related
    const completelyRandom = Math.random() < 0.3

    if (completelyRandom) {
      // Generate a completely random color
      const newHue = Math.floor(Math.random() * 360)
      const newSaturation = 20 + Math.random() * 80 // 20-100%
      const newLightness = 20 + Math.random() * 60 // 20-80%

      const newColor = hslToHex(newHue, newSaturation, newLightness)
      setBaseColor(newColor)
      setInputValue(newColor)
    } else {
      // Generate a color with wider variation but still somewhat related
      const [currentHue, _, __] = hexToHSL(baseColor)

      // Much wider hue variation (±60°)
      const newHue = (currentHue + (Math.random() * 120 - 60) + 360) % 360
      const newSaturation = 20 + Math.random() * 80 // 20-100%
      const newLightness = 20 + Math.random() * 60 // 20-80%

      const newColor = hslToHex(newHue, newSaturation, newLightness)
      setBaseColor(newColor)
      setInputValue(newColor)
    }

    toast({
      title: "Color Randomized",
      description: `New base color: ${baseColor}`,
      duration: 1000,
    })

    // Reset randomizing state after animation
    setTimeout(() => {
      setIsRandomizing(false)
    }, 500)
  }

  // Helper function to calculate relative luminance
  const getLuminance = (hex: string) => {
    // Remove # if present
    hex = hex.replace("#", "")

    // Convert hex to rgb
    const r = Number.parseInt(hex.substr(0, 2), 16) / 255
    const g = Number.parseInt(hex.substr(2, 2), 16) / 255
    const b = Number.parseInt(hex.substr(4, 2), 16) / 255

    // Calculate luminance
    const R = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4)
    const G = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4)
    const B = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4)

    return 0.2126 * R + 0.7152 * G + 0.0722 * B
  }

  // Calculate contrast ratio
  const getContrastRatio = useCallback(
    (color1: string, color2: string) => {
      const luminance1 = getLuminance(color1)
      const luminance2 = getLuminance(color2)

      const lighter = Math.max(luminance1, luminance2)
      const darker = Math.min(luminance1, luminance2)

      return (lighter + 0.05) / (darker + 0.05)
    },
    [], // Removed getLuminance as a dependency
  )

  // Calculate accessibility scores for all shade combinations
  const calculatePaletteAccessibility = useMemo(() => {
    // Skip some shades to avoid too many combinations
    const testShades = [50, 100, 200, 500, 700, 900]
    const results: ContrastScore[] = []

    // Test all combinations of shades against each other
    for (let i = 0; i < testShades.length; i++) {
      for (let j = i + 1; j < testShades.length; j++) {
        const bgShade = colorShades.find((s) => s.shade === testShades[i])
        const fgShade = colorShades.find((s) => s.shade === testShades[j])

        if (bgShade && fgShade) {
          const ratio = getContrastRatio(bgShade.hex, fgShade.hex)
          let level = ""
          let pass = false

          if (ratio >= 7) {
            level = "AAA"
            pass = true
          } else if (ratio >= 4.5) {
            level = "AA"
            pass = true
          } else if (ratio >= 3) {
            level = "AA Large"
            pass = true
          } else {
            level = "Fail"
            pass = false
          }

          results.push({
            background: bgShade,
            foreground: fgShade,
            ratio,
            level,
            pass,
          })
        }
      }
    }

    // Sort by contrast ratio (highest first)
    return results.sort((a, b) => b.ratio - a.ratio)
  }, [colorShades, getContrastRatio])

  // Get passing combinations
  const passingCombinations = useMemo(() => {
    return calculatePaletteAccessibility.filter((score) => score.pass)
  }, [calculatePaletteAccessibility])

  // Get failing combinations
  const failingCombinations = useMemo(() => {
    return calculatePaletteAccessibility.filter((score) => !score.pass)
  }, [calculatePaletteAccessibility])

  return (
    <div className="space-y-6 scrollbar-v0">
      {/* Header with animated gradient background */}
      <motion.div
        className="relative overflow-hidden rounded-xl p-8 mb-8"
        style={{
          background: isDarkMode
            ? `linear-gradient(135deg, ${colorShades[9]?.hex || "#000"} 0%, ${colorShades[7]?.hex || "#111"} 100%)`
            : `linear-gradient(135deg, ${colorShades[8]?.hex || "#111"} 0%, ${colorShades[5]?.hex || "#333"} 100%)`,
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="absolute inset-0 bg-grid-v0" />

        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <motion.div
              className="w-14 h-14 rounded-lg shadow-lg glow-primary"
              style={{ backgroundColor: baseColor }}
              animate={{ backgroundColor: baseColor }}
              transition={{ duration: 0.3 }}
            />
            <div>
              <h1 className="text-3xl font-bold text-white text-shadow-sm">Palette Studio</h1>
              <p className="text-white/80 font-mono mt-1">{baseColor}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
            <Button
              variant="outline"
              size="sm"
              className="button-v0 text-white"
              onClick={() => handleThemeToggle(!isDarkMode)}
            >
              {isDarkMode ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
              {isDarkMode ? "Light Mode" : "Dark Mode"}
            </Button>

            <Button variant="outline" size="sm" className="button-v0 text-white" onClick={downloadTailwindConfig}>
              <Code className="h-4 w-4 mr-2" />
              Tailwind
            </Button>

            <Button variant="outline" size="sm" className="button-v0 text-white" onClick={downloadCSS}>
              <Download className="h-4 w-4 mr-2" />
              CSS
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Main content with tabs */}
      <Tabs defaultValue="palette" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 mb-8 bg-secondary/50 dark:bg-secondary/30 border dark:border-border glass-effect">
          <TabsTrigger
            value="palette"
            className="flex items-center gap-2 data-[state=active]:bg-background/80 dark:data-[state=active]:bg-background/80 backdrop-blur-sm"
          >
            <Palette className="h-4 w-4" />
            <span>Palette</span>
          </TabsTrigger>
          <TabsTrigger
            value="generator"
            className="flex items-center gap-2 data-[state=active]:bg-background/80 dark:data-[state=active]:bg-background/80 backdrop-blur-sm"
          >
            <Zap className="h-4 w-4" />
            <span>Generator</span>
          </TabsTrigger>
          <TabsTrigger
            value="accessibility"
            className="flex items-center gap-2 data-[state=active]:bg-background/80 dark:data-[state=active]:bg-background/80 backdrop-blur-sm"
          >
            <AlertCircle className="h-4 w-4" />
            <span>Accessibility</span>
          </TabsTrigger>
        </TabsList>

        {/* Palette Tab */}
        <TabsContent value="palette" className="space-y-8">
          {/* Color Spectrum Display */}
          <motion.div
            className="h-28 rounded-xl overflow-hidden flex shadow-lg glow-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {colorShades.map(({ shade, hex }, index) => (
              <motion.div
                key={shade}
                className="flex-1 relative group"
                style={{ backgroundColor: hex }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.05 * index }}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-200">
                  <span className="text-white font-bold">{shade}</span>
                  <span className="text-white/90 text-xs font-mono mt-1">{hex}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Color Shades Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {colorShades.map(({ shade, hex, hue, saturation, lightness }, index) => (
              <motion.div
                key={shade}
                className="relative group overflow-hidden rounded-xl card-v0"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.03 * index }}
                whileHover={{ y: -5 }}
              >
                <div className="h-36 w-full relative" style={{ backgroundColor: hex }}>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                    <motion.button
                      className="bg-black/30 backdrop-blur-sm text-white p-2 rounded-full"
                      onClick={() => copyToClipboard(hex)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      {copiedHex === hex ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                    </motion.button>
                  </div>
                </div>
                <div className="p-4 bg-card/80 backdrop-blur-sm border-t border-border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-xl">{shade}</span>
                    <div className="font-mono text-sm text-muted-foreground">{hex}</div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-1 text-xs">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">H</span>
                      <span>{hue}°</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">S</span>
                      <span>{saturation}%</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">L</span>
                      <span>{lightness}%</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Generator Tab */}
        <TabsContent value="generator" className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Color Picker Card */}
            <Card className="dark:border-border/50 dark:shadow-none card-v0 overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <span>Base Color</span>
                  <div className="w-8 h-8 rounded-full shadow-inner" style={{ backgroundColor: baseColor }} />
                </CardTitle>
                <CardDescription>Select your base color to generate a palette</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="relative aspect-video w-full rounded-lg overflow-hidden border dark:border-border/50 glow-white">
                  <HexColorPicker
                    color={baseColor}
                    onChange={setBaseColor}
                    style={{
                      width: "100%",
                      height: "100%",
                    }}
                  />
                </div>

                <div className="flex items-center space-x-3">
                  <motion.div
                    className="w-12 h-12 rounded-md shadow-md"
                    style={{ backgroundColor: baseColor }}
                    animate={{ backgroundColor: baseColor }}
                    transition={{ duration: 0.3 }}
                  />
                  <motion.input
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value)
                    }}
                    onBlur={() => {
                      const validHex = formatHexValue(inputValue)
                      setInputValue(validHex)
                      setBaseColor(validHex)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const validHex = formatHexValue(inputValue)
                        setInputValue(validHex)
                        setBaseColor(validHex)
                        e.currentTarget.blur()
                      }
                    }}
                    className="flex-1 px-4 py-3 border rounded-lg text-sm font-mono transition-all duration-200 focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-secondary/80 dark:border-border/50 glass-effect"
                    placeholder="#RRGGBB"
                    initial={{ scale: 1 }}
                    whileFocus={{ scale: 1.01 }}
                    transition={{ duration: 0.2 }}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={randomizeColor}
                    disabled={isRandomizing}
                    className="dark:border-border/50 button-v0 h-12 w-12"
                  >
                    <RefreshCw className={`h-5 w-5 ${isRandomizing ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Controls Card */}
            <Card className="dark:border-border/50 dark:shadow-none card-v0">
              <CardHeader className="pb-3">
                <CardTitle>Palette Controls</CardTitle>
                <CardDescription>Adjust settings to fine-tune your palette</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-sm font-medium">Vibrancy</Label>
                      <span className="text-sm text-muted-foreground">{vibrancy}%</span>
                    </div>
                    <Slider
                      value={[vibrancy]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={(value) => setVibrancy(value[0])}
                      className="transition-all duration-150 ease-out"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-sm font-medium">Hue Shift</Label>
                      <span className="text-sm text-muted-foreground">{hueShift}°</span>
                    </div>
                    <Slider
                      value={[hueShift]}
                      min={-180}
                      max={180}
                      step={1}
                      onValueChange={(value) => setHueShift(value[0])}
                      className="transition-all duration-150 ease-out"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview Section */}
          <Card className="dark:border-border/50 dark:shadow-none card-v0">
            <CardHeader className="pb-3">
              <CardTitle>Preview</CardTitle>
              <CardDescription>See how your colors look in a real UI</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Button Preview */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Buttons</h4>
                  <div className="space-y-3 p-5 rounded-lg border dark:border-border/50 glass-effect">
                    <button
                      className="w-full py-2.5 px-4 rounded-md text-white font-medium transition-all duration-200 hover:brightness-110"
                      style={{ backgroundColor: colorShades[5]?.hex || "#000" }}
                    >
                      Primary Button
                    </button>
                    <button
                      className="w-full py-2.5 px-4 rounded-md font-medium border-2 transition-all duration-200 hover:bg-opacity-10"
                      style={{
                        borderColor: colorShades[5]?.hex || "#000",
                        color: colorShades[5]?.hex || "#000",
                        backgroundColor: `${colorShades[5]?.hex || "#000"}00`,
                      }}
                    >
                      Outline Button
                    </button>
                    <button
                      className="w-full py-2.5 px-4 rounded-md text-white font-medium opacity-50"
                      style={{ backgroundColor: colorShades[5]?.hex || "#000" }}
                    >
                      Disabled Button
                    </button>
                  </div>
                </div>

                {/* Card Preview */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Card</h4>
                  <div
                    className="p-5 rounded-lg shadow-md"
                    style={{ backgroundColor: colorShades[1]?.hex || "#f8f9fa" }}
                  >
                    <div
                      className="h-5 w-28 rounded mb-3"
                      style={{ backgroundColor: colorShades[3]?.hex || "#ccc" }}
                    ></div>
                    <div
                      className="h-3 w-full rounded mb-1.5"
                      style={{ backgroundColor: colorShades[2]?.hex || "#ddd" }}
                    ></div>
                    <div
                      className="h-3 w-3/4 rounded mb-4"
                      style={{ backgroundColor: colorShades[2]?.hex || "#ddd" }}
                    ></div>
                    <div className="h-7 w-20 rounded" style={{ backgroundColor: colorShades[5]?.hex || "#000" }}></div>
                  </div>
                </div>

                {/* Alert Preview */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Alert</h4>
                  <div
                    className="p-5 rounded-lg border-l-4 shadow-md"
                    style={{
                      backgroundColor: colorShades[0]?.hex || "#f8f9fa",
                      borderLeftColor: colorShades[5]?.hex || "#000",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="h-5 w-5 rounded-full"
                        style={{ backgroundColor: colorShades[5]?.hex || "#000" }}
                      ></div>
                      <div
                        className="h-4 w-28 rounded"
                        style={{ backgroundColor: colorShades[3]?.hex || "#ccc" }}
                      ></div>
                    </div>
                    <div
                      className="h-2.5 w-full rounded mt-2"
                      style={{ backgroundColor: colorShades[2]?.hex || "#ddd" }}
                    ></div>
                    <div
                      className="h-2.5 w-5/6 rounded mt-1.5"
                      style={{ backgroundColor: colorShades[2]?.hex || "#ddd" }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accessibility Tab */}
        <TabsContent value="accessibility" className="space-y-8">
          <Card className="dark:border-border/50 dark:shadow-none card-v0">
            <CardHeader className="pb-3">
              <CardTitle>Accessibility Analysis</CardTitle>
              <CardDescription>Check which color combinations meet WCAG accessibility standards</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {/* Passing combinations */}
                <div>
                  <h4 className="text-sm font-medium text-green-500 dark:text-green-400 mb-4 flex items-center">
                    <Check className="h-4 w-4 mr-2" />
                    Accessible Combinations ({passingCombinations.length})
                  </h4>

                  {passingCombinations.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {passingCombinations.slice(0, 9).map((score, index) => (
                        <div
                          key={index}
                          className="flex flex-col p-4 rounded-lg border border-green-100 dark:border-green-900/30 bg-green-50/80 dark:bg-green-900/5 glass-effect"
                        >
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-7 h-7 rounded-md shadow-sm"
                                style={{ backgroundColor: score.background.hex }}
                              ></div>
                              <span className="text-sm font-medium">{score.background.shade}</span>
                            </div>
                            <div className="px-2.5 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 font-medium">
                              {score.level}
                            </div>
                          </div>

                          <div
                            className="p-4 rounded-md flex items-center justify-center text-center font-medium shadow-sm"
                            style={{
                              backgroundColor: score.background.hex,
                              color: score.foreground.hex,
                            }}
                          >
                            Text on {score.background.shade} background
                          </div>

                          <div className="flex justify-between items-center mt-3 text-xs">
                            <span>
                              Contrast ratio: <strong>{score.ratio.toFixed(2)}:1</strong>
                            </span>
                            <span>
                              with <strong>{score.foreground.shade}</strong>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 italic p-5 border rounded-lg dark:border-border/50 glass-effect">
                      No accessible combinations found. Try adjusting your base color.
                    </div>
                  )}
                </div>

                {/* Failing combinations */}
                <div>
                  <h4 className="text-sm font-medium text-red-500 dark:text-red-400 mb-4 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Inaccessible Combinations ({failingCombinations.length})
                  </h4>

                  {failingCombinations.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {failingCombinations.slice(0, 6).map((score, index) => (
                        <div
                          key={index}
                          className={`flex flex-col p-4 rounded-lg ${
                            isDarkMode
                              ? "border border-red-100 dark:border-red-900/30 bg-red-50/80 dark:bg-red-900/5 glass-effect"
                              : "border border-red-200 bg-red-50/50"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-7 h-7 rounded-md shadow-sm"
                                style={{ backgroundColor: score.background.hex }}
                              ></div>
                              <span className="text-sm font-medium">{score.background.shade}</span>
                            </div>
                            <div
                              className={`px-2.5 py-1 text-xs rounded-full ${
                                isDarkMode
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                                  : "bg-red-100 text-red-800"
                              } font-medium`}
                            >
                              {score.level}
                            </div>
                          </div>

                          <div
                            className="p-4 rounded-md flex items-center justify-center text-center font-medium shadow-sm"
                            style={{
                              backgroundColor: score.background.hex,
                              color: score.foreground.hex,
                            }}
                          >
                            Text on {score.background.shade} background
                          </div>

                          <div className="flex justify-between items-center mt-3 text-xs">
                            <span>
                              Contrast ratio: <strong>{score.ratio.toFixed(2)}:1</strong>
                            </span>
                            <span>
                              with <strong>{score.foreground.shade}</strong>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className={`text-sm text-green-500 dark:text-green-400 p-5 border ${
                        isDarkMode
                          ? "border-green-100 dark:border-green-900/30 rounded-lg bg-green-50/80 dark:bg-green-900/5 glass-effect"
                          : "border-green-200 rounded-lg bg-green-50/50"
                      }`}
                    >
                      All combinations are accessible! Your palette has excellent contrast.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

