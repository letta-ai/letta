# Use an official Python runtime as a parent image
# TODO: change this image since it is reporting with high severity vulnerability
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the current directory contents into the container at /usr/src/app
COPY apps/free-proxy/. .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Make port 8080 available to the world outside this container
EXPOSE 8080

# Define environment variables
# ENV NAME World

# Run main.py when the container launches
CMD ["/bin/sh", "-c", "sleep 15 && uvicorn main:app --host 0.0.0.0 --port 8080"]
