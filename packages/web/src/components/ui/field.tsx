"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

// FieldSet
const FieldSet = React.forwardRef<
  HTMLFieldSetElement,
  React.ComponentPropsWithoutRef<"fieldset">
>(({ className, ...props }, ref) => (
  <fieldset
    ref={ref}
    className={cn("grid gap-6", className)}
    {...props}
  />
))
FieldSet.displayName = "FieldSet"

// FieldLegend
const FieldLegend = React.forwardRef<
  HTMLLegendElement,
  React.ComponentPropsWithoutRef<"legend"> & {
    variant?: "legend" | "label"
  }
>(({ className, variant = "legend", ...props }, ref) => (
  <legend
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none",
      variant === "label" && "text-base font-semibold",
      className
    )}
    {...props}
  />
))
FieldLegend.displayName = "FieldLegend"

// FieldGroup
const FieldGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("grid gap-4", className)}
    {...props}
  />
))
FieldGroup.displayName = "FieldGroup"

// Field
const Field = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div"> & {
    orientation?: "vertical" | "horizontal" | "responsive"
    "data-invalid"?: boolean
  }
>(({ className, orientation = "vertical", "data-invalid": invalid, ...props }, ref) => (
  <div
    ref={ref}
    data-invalid={invalid}
    className={cn(
      "grid gap-2",
      orientation === "horizontal" && "grid-cols-[1fr_auto] items-center gap-4",
      orientation === "responsive" && "@container/field-group grid grid-cols-1 @lg:grid-cols-[1fr_auto] @lg:items-center @lg:gap-4",
      invalid && "text-destructive",
      className
    )}
    {...props}
  />
))
Field.displayName = "Field"

// FieldContent
const FieldContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("grid gap-1", className)}
    {...props}
  />
))
FieldContent.displayName = "FieldContent"

// FieldLabel
const FieldLabel = React.forwardRef<
  HTMLLabelElement,
  React.ComponentPropsWithoutRef<"label"> & {
    asChild?: boolean
  }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "label"
  return (
    <Comp
      ref={ref}
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
})
FieldLabel.displayName = "FieldLabel"

// FieldTitle
const FieldTitle = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<"p">
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm font-medium leading-none", className)}
    {...props}
  />
))
FieldTitle.displayName = "FieldTitle"

// FieldDescription
const FieldDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<"p">
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
FieldDescription.displayName = "FieldDescription"

// FieldSeparator
const FieldSeparator = React.forwardRef<
  HTMLHRElement,
  React.ComponentPropsWithoutRef<"hr">
>(({ className, ...props }, ref) => (
  <hr
    ref={ref}
    className={cn("my-4 border-border", className)}
    {...props}
  />
))
FieldSeparator.displayName = "FieldSeparator"

// FieldError
const FieldError = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<"p"> & {
    errors?: Array<{ message?: string } | undefined>
  }
>(({ className, errors, children, ...props }, ref) => {
  const errorMessages = errors?.filter(Boolean).map(error => error?.message).filter(Boolean)

  if (!errorMessages?.length && !children) {
    return null
  }

  return (
    <p
      ref={ref}
      className={cn("text-sm font-medium text-destructive", className)}
      {...props}
    >
      {children || (
        <ul className="list-disc list-inside space-y-1">
          {errorMessages?.map((message, index) => (
            <li key={index}>{message}</li>
          ))}
        </ul>
      )}
    </p>
  )
})
FieldError.displayName = "FieldError"

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
}