#!/bin/bash
# Cleanup old CI runner images

ENVIRONMENT=$1
PROJECT_ID=$2
IMAGE_FAMILY="ci-runner-${ENVIRONMENT}"
KEEP_LATEST=3

# Check parameters
if [ -z "$ENVIRONMENT" ] || [ -z "$PROJECT_ID" ]; then
  echo "Usage: $0 <environment> <project_id>"
  exit 1
fi

echo "Cleaning up old images for family: $IMAGE_FAMILY in project: $PROJECT_ID"

# List all images in the family, sorted by creation time
IMAGES=$(gcloud compute images list \
  --project=${PROJECT_ID} \
  --filter="family=${IMAGE_FAMILY}" \
  --format="value(name)" \
  --sort-by=~creationTimestamp)

# Keep only the N latest images
COUNT=0
for IMAGE in $IMAGES; do
  COUNT=$((COUNT+1))
  if [ $COUNT -gt $KEEP_LATEST ]; then
    echo "Deleting old image: $IMAGE"
    gcloud compute images delete $IMAGE --project=${PROJECT_ID} --quiet
  else
    echo "Keeping image: $IMAGE"
  fi
done

echo "Cleanup completed."
